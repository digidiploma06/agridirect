"""AI endpoints: crop advice, demand prediction, market series (FR-05, 06, 08, 15)."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter
from sqlalchemy import select

from ..catalogue import CROPS, DISTRICTS, MANDIS, get_crop, get_district, get_mandi
from ..deps import CurrentUser, Db, Farmer
from ..domain.advice import recommend
from ..domain.dates import add_days, today_iso, week_start
from ..domain.geo import js_round
from ..errors import ApiError
from ..models import MarketPrice
from ..schemas import AdviceIn
from ..signals import active_model, get_signal, platform_demand, prediction_for

router = APIRouter(tags=["insights"])
DISCLAIMER = "Advisory only. Prices and demand can change."


@router.get("/catalogue")
def catalogue():
    return {"crops": CROPS, "districts": DISTRICTS, "mandis": MANDIS}


@router.post("/advice/crops")
def advice(body: AdviceIn, user: Farmer, db: Db):
    district = get_district(body.districtId)
    if not district:
        raise ApiError(422, "district_required")
    if not (0 < body.landAreaAcres <= 10000):
        raise ApiError(422, "land_area_invalid")
    c = district["centroid"]
    recs = recommend(
        CROPS,
        district["id"],
        body.season,
        body.irrigation,
        body.soilType,
        district["zoneKey"],
        signal_for=lambda crop_id: get_signal(db, crop_id, district["id"]),
        platform_for=lambda crop_id: platform_demand(db, crop_id, c["lat"], c["lng"]),
        as_of=today_iso(),
    )
    model = active_model(db)
    return {"asOf": today_iso(), "modelVersion": model.version if model else "none", "recommendations": recs, "disclaimer": DISCLAIMER}


@router.get("/predictions/demand")
def demand(crop: str, district: str, user: CurrentUser, db: Db):
    if not get_crop(crop):
        raise ApiError(422, "crop_required")
    if not get_district(district):
        raise ApiError(422, "district_required")
    return prediction_for(db, crop, district)


def weekly_series(db, crop_id: str, mandi_id: str, weeks: int = 52) -> list[dict]:
    """Daily mandi rows aggregated to weeks (Monday start)."""
    last_week = week_start(today_iso())
    first = add_days(last_week, -7 * (weeks - 1))
    rows = db.execute(
        select(MarketPrice.date, MarketPrice.modal_price, MarketPrice.min_price, MarketPrice.max_price, MarketPrice.arrivals_t)
        .where(MarketPrice.crop_id == crop_id, MarketPrice.mandi_id == mandi_id, MarketPrice.date >= first)
        .order_by(MarketPrice.date)
    ).all()
    buckets: dict[str, list] = defaultdict(list)
    for r in rows:
        buckets[week_start(r.date)].append(r)
    out = []
    for wk in sorted(buckets):
        rs = buckets[wk]
        n = len(rs)
        out.append(
            {
                "week": wk,
                "modalPrice": js_round(sum(r.modal_price for r in rs) / n),
                "minPrice": js_round(sum(r.min_price for r in rs) / n),
                "maxPrice": js_round(sum(r.max_price for r in rs) / n),
                "arrivalsT": js_round(sum(r.arrivals_t or 0 for r in rs)),
            }
        )
    return out


@router.get("/market/prices")
def market_prices(crop: str, mandi: str, user: CurrentUser, db: Db):
    if not get_crop(crop):
        raise ApiError(422, "crop_required")
    if not get_mandi(mandi):
        raise ApiError(404, "not_found")
    return weekly_series(db, crop, mandi)


SNAPSHOT = [("onion", "m-lasalgaon", "Lasalgaon"), ("maize", "m-ahilyanagar", "Ahilyanagar"), ("soybean", "m-pune", "Pune"), ("tur", "m-solapur", "Solapur"), ("tomato", "m-pune", "Pune")]


@router.get("/market/snapshot")
def market_snapshot(db: Db):
    """Latest modal price per crop at its main pilot mandi (public, for the home page)."""
    out = []
    for crop_id, mandi_id, mandi_name in SNAPSHOT:
        series = weekly_series(db, crop_id, mandi_id, weeks=8)
        if not series:
            continue
        last = series[-1]["modalPrice"]
        prev = series[-5]["modalPrice"] if len(series) >= 5 else series[0]["modalPrice"]
        out.append({"cropId": crop_id, "mandiName": mandi_name, "modalPrice": last, "change4w": (last - prev) / prev if prev else 0})
    return out
