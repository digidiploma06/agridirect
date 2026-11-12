"""Bridge between the ML output (predictions table) and the API.

Cold start (PRD 8.3): a district without its own prediction falls back to the
state-level average for that crop, flagged so the UI caps confidence and says so.
"""
from __future__ import annotations

import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalogue import get_district
from .domain.advice import Signal, classify, explain
from .domain.dates import today_iso
from .domain.geo import haversine_km
from .models import ModelVersion, Prediction
from .views import live_requirements

DEMAND_RADIUS_KM = 100
DEFAULT_HORIZON_WEEKS = 8
_CACHE_TTL_S = 60
_cache: dict[tuple[str, str], tuple[float, Signal]] = {}


def invalidate_cache() -> None:
    _cache.clear()


def active_model(db: Session) -> ModelVersion | None:
    return db.scalars(select(ModelVersion).where(ModelVersion.active.is_(True)).order_by(ModelVersion.trained_at.desc())).first()


def _latest_rows(db: Session, crop_id: str, version: str) -> list[Prediction]:
    rows = db.scalars(select(Prediction).where(Prediction.crop_id == crop_id, Prediction.model_version == version).order_by(Prediction.as_of.desc())).all()
    if not rows:
        return []
    latest = rows[0].as_of
    return [r for r in rows if r.as_of == latest]


def get_signal(db: Session, crop_id: str, district_id: str) -> Signal:
    key = (crop_id, district_id)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < _CACHE_TTL_S:
        return hit[1]
    model = active_model(db)
    signal = Signal(0.0, 0.0, 30.0, fallback=True, model_version=model.version if model else "none", horizon_weeks=DEFAULT_HORIZON_WEEKS)
    if model:
        rows = _latest_rows(db, crop_id, model.version)
        own = next((r for r in rows if r.district_id == district_id), None)
        if own:
            signal = Signal(own.forecast_price_change_pct, own.arrival_anomaly_pct, own.historical_mape_pct, bool(own.fallback), list(own.drivers or []), own.model_version, own.horizon_weeks, own.as_of)
        elif rows:
            n = len(rows)
            signal = Signal(
                sum(r.forecast_price_change_pct for r in rows) / n,
                sum(r.arrival_anomaly_pct for r in rows) / n,
                sum(r.historical_mape_pct for r in rows) / n,
                True,
                [],
                model.version,
                rows[0].horizon_weeks,
                rows[0].as_of,
            )
    _cache[key] = (time.monotonic(), signal)
    return signal


def platform_demand(db: Session, crop_id: str, lat: float, lng: float, radius_km: float = DEMAND_RADIUS_KM) -> tuple[int, int]:
    """Open verified-company requirement kilograms (and distinct buyers) near a point."""
    near = [r for r in live_requirements(db, crop_id) if haversine_km(r.lat, r.lng, lat, lng) <= radius_km]
    return sum(r.qty_kg for r in near), len({r.company_id for r in near})


def prediction_for(db: Session, crop_id: str, district_id: str, at: tuple[float, float] | None = None) -> dict:
    district = get_district(district_id)
    point = at or ((district["centroid"]["lat"], district["centroid"]["lng"]) if district else (18.52, 73.86))
    signal = get_signal(db, crop_id, district_id)
    kg, buyers = platform_demand(db, crop_id, point[0], point[1])
    c = classify(signal, kg)
    return {
        "cropId": crop_id,
        "districtId": district_id,
        "asOf": signal.as_of or today_iso(),
        "horizonWeeks": signal.horizon_weeks,
        "demandLevel": c["demandLevel"],
        "trend": c["trend"],
        "priceDirection": c["priceDirection"],
        "confidence": c["confidence"],
        "lowConfidenceFallback": signal.fallback,
        "modelVersion": signal.model_version,
        "explanation": explain(signal, kg, buyers),
        "disclaimer": "Advisory only. Prices and demand can change.",
    }
