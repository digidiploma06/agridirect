"""Turn the trained model into per-district signals stored in `predictions`.

For the latest week of each crop x mandi series: forecast the 8-week price
change, read the arrival anomaly, and use LightGBM's TreeSHAP contributions
(`pred_contrib`) to pick rainfall drivers for the explanation text. Mandi
signals are averaged to the district. Also runs a simple drift check.
"""
from __future__ import annotations

import json
import logging
from datetime import date

import lightgbm as lgb
import numpy as np
import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.domain.advice import Signal, classify
from app.domain.dates import now_iso, today_iso
from app.models import ModelVersion, Prediction

from .features import FEATURES, PRIMARY_HORIZON, RAIN_FEATURES, build_panel, design_matrix, load_weekly_prices, load_weekly_weather

log = logging.getLogger("agridirect.ml")
STALE_AFTER_DAYS = 21
MAX_ABS_CHANGE_PCT = 60.0
DRIFT_Z = 3.0


def _active(db: Session) -> ModelVersion | None:
    return db.scalars(select(ModelVersion).where(ModelVersion.active.is_(True)).order_by(ModelVersion.trained_at.desc())).first()


def _mape_lookup(card: dict) -> tuple[dict, dict]:
    by_cd = {(r["cropId"], r["districtId"]): r["mapeModel"] for r in card.get("perCropDistrict", [])}
    by_c = {r["cropId"]: r["mapeModel"] for r in card.get("perCrop", [])}
    return by_cd, by_c


def refresh_predictions(db: Session) -> int:
    mv = _active(db)
    if mv is None:
        return 0
    path = settings.model_dir / mv.version / f"h{PRIMARY_HORIZON}.txt"
    if not path.exists():
        log.warning("model file missing for %s; retrain needed", mv.version)
        return 0
    booster = lgb.Booster(model_file=str(path))
    panel = build_panel(load_weekly_prices(db), load_weekly_weather(db))
    if panel.empty:
        return 0
    today = date.fromisoformat(today_iso())
    latest = panel.dropna(subset=["price", "ret_8"]).sort_values("week").groupby(["crop_id", "mandi_id"]).tail(1)
    if latest.empty:
        return 0
    X = design_matrix(latest, PRIMARY_HORIZON)
    contrib = booster.predict(X, pred_contrib=True)  # (n, n_features + 1), last column = base value
    y_hat = contrib.sum(axis=1)
    rain_idx = [FEATURES.index(f) for f in RAIN_FEATURES]
    by_cd, by_c = _mape_lookup(mv.metrics or {})

    per_district: dict[tuple[str, str], list[dict]] = {}
    for i, (_, row) in enumerate(latest.iterrows()):
        stale_days = (today - row["week"].date()).days
        rain_effect = float(contrib[i, rain_idx].sum())
        rain_anom = row.get("rain8_anom")
        per_district.setdefault((row["crop_id"], row["district_id"]), []).append(
            {
                "pct": float(np.clip((np.exp(y_hat[i]) - 1) * 100, -MAX_ABS_CHANGE_PCT, MAX_ABS_CHANGE_PCT)),
                "arr": float(row["arr_anom_4w"] * 100) if pd.notna(row["arr_anom_4w"]) else 0.0,
                "has_arrivals": bool(pd.notna(row["arr_anom_4w"])),
                "stale": stale_days > STALE_AFTER_DAYS,
                "rain_effect": rain_effect,
                "rain_anom": float(rain_anom) if pd.notna(rain_anom) else None,
            }
        )

    as_of = today.isoformat()
    db.execute(delete(Prediction).where(Prediction.as_of == as_of, Prediction.model_version == mv.version))
    count = 0
    for (crop, district), items in per_district.items():
        pct = float(np.mean([x["pct"] for x in items]))
        arr = float(np.mean([x["arr"] for x in items]))
        mape = float(by_cd.get((crop, district), by_c.get(crop, 30.0)))
        fallback = any(x["stale"] for x in items)
        drivers = []
        rain_effect = float(np.mean([x["rain_effect"] for x in items]))
        anoms = [x["rain_anom"] for x in items if x["rain_anom"] is not None]
        if anoms and abs(rain_effect) >= 0.01 and abs(np.mean(anoms)) >= 0.15:
            a = float(np.mean(anoms))
            drivers.append({"key": "rain_high" if a > 0 else "rain_low", "params": {"pct": int(round(min(abs(a), 3.0) * 100))}, "weight": round(abs(rain_effect) * 150, 2)})
        c = classify(Signal(pct, arr, mape, fallback), 0)
        db.add(
            Prediction(
                crop_id=crop,
                district_id=district,
                as_of=as_of,
                horizon_weeks=PRIMARY_HORIZON,
                forecast_price_change_pct=round(pct, 2),
                arrival_anomaly_pct=round(arr, 2),
                historical_mape_pct=round(mape, 2),
                fallback=fallback,
                demand_level=c["demandLevel"],
                trend=c["trend"],
                price_direction=c["priceDirection"],
                confidence=c["confidence"],
                drivers=drivers,
                model_version=mv.version,
                created_at=now_iso(),
            )
        )
        count += 1

    # Drift check: recent 4-week returns versus the training distribution, per crop.
    stats = (mv.metrics or {}).get("featureStats", {})
    drift = []
    recent_cut = panel["week"].max() - pd.Timedelta(weeks=8)
    for crop, g in panel[panel["week"] > recent_cut].groupby("crop_id"):
        ref = stats.get(crop)
        if not ref or g["ret_4"].dropna().empty:
            continue
        z = (float(g["ret_4"].mean()) - ref["ret_4_mean"]) / (ref["ret_4_std"] / np.sqrt(max(1, g["ret_4"].notna().sum())))
        drift.append({"cropId": crop, "z": round(float(z), 2), "flag": bool(abs(z) > DRIFT_Z)})
    metrics = dict(mv.metrics or {})
    metrics["drift"] = {"checkedAt": now_iso(), "staleDays": int((today - panel["week"].max().date()).days), "perCrop": drift}
    mv.metrics = json.loads(json.dumps(metrics))
    db.commit()

    from app.signals import invalidate_cache

    invalidate_cache()
    return count
