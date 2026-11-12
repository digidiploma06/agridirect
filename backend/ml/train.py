"""Train and validate the price forecaster (TRD sections 7.3-7.4).

* Target: log price change over 4 / 8 / 12 weeks (direct multi-horizon), one
  LightGBM model per horizon pooled over crops and mandis.
* Validation: rolling-origin (walk-forward) folds. A training row is only used
  if its target date falls before the test block starts, so nothing leaks.
* Baselines: seasonal-naive (price one year before the target week) and
  last-value naive.
* Output: model files + model_card.json + MODEL_CARD.md, and a row in
  model_versions with the metrics the admin page shows.

Run:  python -m ml.train
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.catalogue import CROP_IDS, get_district
from app.config import settings
from app.models import ModelVersion

from .features import CATEGORICAL, FEATURES, HORIZONS, PRIMARY_HORIZON, build_panel, design_matrix, load_weekly_prices, load_weekly_weather, season_of

N_FOLDS = 4
FOLD_WEEKS = 26
MIN_TRAIN_ROWS = 400
DIRECTION_THRESHOLD = 0.04
LGB_PARAMS = dict(objective="regression", n_estimators=300, learning_rate=0.04, num_leaves=15, min_child_samples=25, subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0, random_state=42, verbose=-1, n_jobs=2)


class NotEnoughData(Exception):
    pass


def _fit(X: pd.DataFrame, y: pd.Series) -> lgb.LGBMRegressor:
    model = lgb.LGBMRegressor(**LGB_PARAMS)
    model.fit(X, y, categorical_feature=CATEGORICAL)
    return model


def _direction(pct: np.ndarray) -> np.ndarray:
    return np.where(pct > DIRECTION_THRESHOLD, 2, np.where(pct < -DIRECTION_THRESHOLD, 0, 1))


def _metrics(df: pd.DataFrame) -> dict:
    """df columns: actual, pred, naive, last (prices)."""
    a = df["actual"].to_numpy()
    out = {"n": int(len(df))}
    for name, col in (("Model", "pred"), ("Baseline", "naive"), ("LastValue", "last")):
        f = df[col].to_numpy()
        out[f"mape{name}"] = round(float(np.mean(np.abs(f - a) / a) * 100), 2)
        out[f"rmse{name}"] = round(float(np.sqrt(np.mean((f - a) ** 2))), 1)
    last = df["last"].to_numpy()
    true_dir = _direction(a / last - 1)
    out["macroF1"] = round(float(f1_score(true_dir, _direction(df["pred"].to_numpy() / last - 1), average="macro", labels=[0, 1, 2], zero_division=0)), 3)
    out["macroF1Baseline"] = round(float(f1_score(true_dir, _direction(df["naive"].to_numpy() / last - 1), average="macro", labels=[0, 1, 2], zero_division=0)), 3)
    out["beatsBaseline"] = bool(out["mapeModel"] < out["mapeBaseline"])
    return out


def walk_forward(panel: pd.DataFrame, horizon: int) -> tuple[pd.DataFrame, list[dict]]:
    """Out-of-sample predictions for every fold, plus fold descriptions."""
    y_col, naive_col = f"y_{horizon}", f"naive_{horizon}"
    data = panel.dropna(subset=[y_col, naive_col, "ret_52"]).copy()
    weeks = np.sort(data["week"].unique())
    if len(weeks) < N_FOLDS * FOLD_WEEKS + 30:
        raise NotEnoughData(f"need about {N_FOLDS * FOLD_WEEKS + 30} usable weeks for validation, have {len(weeks)}")
    preds, folds = [], []
    for k in range(N_FOLDS, 0, -1):
        test_weeks = weeks[len(weeks) - k * FOLD_WEEKS : len(weeks) - (k - 1) * FOLD_WEEKS]
        test_start = pd.Timestamp(test_weeks[0])
        # Only rows whose target was already observed before the test block starts.
        train = data[data["week"] + pd.Timedelta(weeks=horizon) < test_start]
        test = data[data["week"].isin(test_weeks)]
        if len(train) < MIN_TRAIN_ROWS or test.empty:
            continue
        model = _fit(design_matrix(train, horizon), train[y_col])
        out = test[["crop_id", "mandi_id", "district_id", "week", "price"]].copy()
        out["pred"] = test["price"].to_numpy() * np.exp(model.predict(design_matrix(test, horizon)))
        out["actual"] = test["price"].to_numpy() * np.exp(test[y_col].to_numpy())
        out["naive"] = test[naive_col].to_numpy()
        out["last"] = test["price"].to_numpy()
        out["target_week"] = out["week"] + pd.Timedelta(weeks=horizon)
        preds.append(out)
        folds.append({"testFrom": str(test_start.date()), "testTo": str(pd.Timestamp(test_weeks[-1]).date()), "trainRows": int(len(train)), "testRows": int(len(test))})
    if not preds:
        raise NotEnoughData("no validation fold had enough training rows")
    return pd.concat(preds, ignore_index=True), folds


def _grouped(preds: pd.DataFrame, keys: list[str], names: list[str]) -> list[dict]:
    rows = []
    for key, g in preds.groupby(keys):
        key = key if isinstance(key, tuple) else (key,)
        rows.append({**dict(zip(names, key)), **_metrics(g)})
    return rows


def train(db: Session, verbose: bool = True) -> ModelVersion:
    say = print if verbose else (lambda *a, **k: None)
    prices = load_weekly_prices(db)
    panel = build_panel(prices, load_weekly_weather(db))
    if panel.empty:
        raise NotEnoughData("no market price data; run ingestion first")
    sources = sorted(set(prices["source"].dropna()))
    data_source = sources[0] if len(sources) == 1 else "mixed"

    by_horizon, primary_preds, primary_folds = [], None, []
    for h in HORIZONS:
        preds, folds = walk_forward(panel, h)
        by_horizon.append({"horizonWeeks": h, **_metrics(preds)})
        say(f"  h={h:>2}w  model MAPE {by_horizon[-1]['mapeModel']:.2f}%  seasonal-naive {by_horizon[-1]['mapeBaseline']:.2f}%  last-value {by_horizon[-1]['mapeLastValue']:.2f}%")
        if h == PRIMARY_HORIZON:
            primary_preds, primary_folds = preds, folds

    p = primary_preds
    p["season"] = p["target_week"].map(season_of)
    per_crop = sorted(_grouped(p, ["crop_id"], ["cropId"]), key=lambda r: CROP_IDS.index(r["cropId"]))
    per_crop_district = _grouped(p, ["crop_id", "district_id"], ["cropId", "districtId"])
    per_crop_season = _grouped(p, ["crop_id", "season"], ["cropId", "season"])

    now = datetime.now(timezone.utc)
    version = f"lgbm-{now:%Y.%m.%d}-{now:%H%M%S}"
    out_dir = settings.model_dir / version
    out_dir.mkdir(parents=True, exist_ok=True)
    importance = {}
    feature_stats = {}
    for h in HORIZONS:
        full = panel.dropna(subset=[f"y_{h}", "ret_52"])
        model = _fit(design_matrix(full, h), full[f"y_{h}"])
        model.booster_.save_model(str(out_dir / f"h{h}.txt"))
        if h == PRIMARY_HORIZON:
            gain = model.booster_.feature_importance(importance_type="gain")
            total = float(gain.sum()) or 1.0
            importance = {f: round(float(g) / total, 4) for f, g in sorted(zip(FEATURES, gain), key=lambda x: -x[1])[:10]}
            # Reference distribution for drift monitoring.
            for crop, g in full.groupby("crop_id"):
                feature_stats[crop] = {"ret_4_mean": float(g["ret_4"].mean()), "ret_4_std": float(g["ret_4"].std() or 1e-6)}

    card = {
        "version": version,
        "trainedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataSource": data_source,
        "dataWindow": {"from": str(panel["week"].min().date()), "to": str(panel["week"].max().date())},
        "series": int(panel.groupby(["crop_id", "mandi_id"]).ngroups),
        "horizons": HORIZONS,
        "primaryHorizon": PRIMARY_HORIZON,
        "algorithm": "LightGBM regression on log price change, one model per horizon, pooled over crops and mandis",
        "validation": {"method": "rolling-origin walk-forward", "folds": primary_folds, "leakGuard": "training rows need target date < test start", "directionThresholdPct": DIRECTION_THRESHOLD * 100},
        "overall": by_horizon[HORIZONS.index(PRIMARY_HORIZON)],
        "byHorizon": by_horizon,
        "perCrop": per_crop,
        "perCropDistrict": per_crop_district,
        "perCropSeason": per_crop_season,
        "featureImportance": importance,
        "featureStats": feature_stats,
        "limitations": [
            ("Trained on SYNTHETIC sample data, not real mandi prices. These metrics show the pipeline works; they say nothing about accuracy on real markets." if data_source == "synthetic" else "Trained on ingested market data; check coverage per crop and mandi before relying on it."),
            "rain_next2 uses actual rainfall in training (perfect-forecast assumption); live forecasts are noisier.",
            "Platform demand (open buyer requirements) is not a model input yet; it is applied afterwards by the demand rules.",
            "SARIMAX / Prophet comparison from the TRD has not been run; baselines are seasonal-naive and last-value.",
            "Demand level and trend are rule-derived from the forecast and the arrival anomaly, not separately learned.",
            "Forecasts are advisory and must never be presented as guaranteed prices.",
        ],
    }
    (out_dir / "model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    (out_dir / "MODEL_CARD.md").write_text(render_card(card), encoding="utf-8")

    db.execute(update(ModelVersion).values(active=False))
    mv = ModelVersion(version=version, trained_at=card["trainedAt"], data_source=data_source, horizon_weeks=PRIMARY_HORIZON, metrics=card, active=True)
    db.add(mv)
    db.commit()
    say(f"  saved {version} -> {out_dir}")
    return mv


def render_card(c: dict) -> str:
    def table(rows: list[dict], first_cols: list[tuple[str, str]]) -> str:
        head = [t for _, t in first_cols] + ["n", "MAPE model %", "MAPE seasonal-naive %", "MAPE last-value %", "RMSE model", "RMSE seasonal-naive", "F1 model", "F1 baseline", "Beats baseline"]
        lines = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
        for r in rows:
            cells = [str(r[k]) for k, _ in first_cols] + [str(r["n"]), f"{r['mapeModel']:.2f}", f"{r['mapeBaseline']:.2f}", f"{r['mapeLastValue']:.2f}", f"{r['rmseModel']:.0f}", f"{r['rmseBaseline']:.0f}", f"{r['macroF1']:.2f}", f"{r['macroF1Baseline']:.2f}", "yes" if r["beatsBaseline"] else "NO"]
            lines.append("| " + " | ".join(cells) + " |")
        return "\n".join(lines)

    district_rows = [{**r, "district": (get_district(r["districtId"]) or {}).get("name", r["districtId"])} for r in c["perCropDistrict"]]
    folds = "\n".join(f"- {f['testFrom']} to {f['testTo']}: trained on {f['trainRows']} rows, tested on {f['testRows']}" for f in c["validation"]["folds"])
    return f"""# Model card: {c['version']}

- Trained: {c['trainedAt']}
- Data source: **{c['dataSource']}**
- Data window: {c['dataWindow']['from']} to {c['dataWindow']['to']} ({c['series']} crop x mandi series, weekly)
- Algorithm: {c['algorithm']}
- Served horizon: {c['primaryHorizon']} weeks (also trained: {', '.join(str(h) for h in c['horizons'])})

## Validation

{c['validation']['method'].capitalize()}; {c['validation']['leakGuard']}. Direction classes use a +/-{c['validation']['directionThresholdPct']:.0f}% threshold (down / stable / up); F1 is macro-averaged.

{folds}

### By horizon (all crops)

{table(c['byHorizon'], [('horizonWeeks', 'Horizon (weeks)')])}

### By crop ({c['primaryHorizon']}-week horizon)

{table(c['perCrop'], [('cropId', 'Crop')])}

### By crop and district

{table(district_rows, [('cropId', 'Crop'), ('district', 'District')])}

### By crop and season (season of the target week)

{table(c['perCropSeason'], [('cropId', 'Crop'), ('season', 'Season')])}

## Top features (share of gain)

{chr(10).join(f'- {k}: {v:.1%}' for k, v in c['featureImportance'].items())}

## Known limitations

{chr(10).join(f'- {l}' for l in c['limitations'])}
"""


if __name__ == "__main__":
    from app.db import SessionLocal, init_db

    init_db()
    with SessionLocal() as session:
        print("Training price forecaster ...")
        mv = train(session)
        from .predict import refresh_predictions

        n = refresh_predictions(session)
        print(f"Active model: {mv.version}; {n} predictions refreshed.")
        print(f"Model card: {settings.model_dir / mv.version / 'MODEL_CARD.md'}")
