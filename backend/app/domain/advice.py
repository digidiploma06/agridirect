"""Demand classification and crop recommendation (TRD section 7.3).

The ML service supplies the *signal* (forecast price change, arrival anomaly,
historical error, SHAP-derived drivers). These transparent rules turn it into
demand level / trend / price direction and rank crops:

    score = 0.5 x suitability + 0.35 x demand/price score + 0.15 x platform demand
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .geo import js_round

PRICE_THRESHOLD_PCT = 4
ARRIVAL_THRESHOLD_PCT = 10
FALLBACK_MAX_CONFIDENCE = 0.4


@dataclass
class Signal:
    forecast_price_change_pct: float
    arrival_anomaly_pct: float
    historical_mape_pct: float
    fallback: bool = False
    drivers: list = field(default_factory=list)  # [{"key":..., "params":..., "weight":...}] from SHAP
    model_version: str = "rules"
    horizon_weeks: int = 8
    as_of: str | None = None


def clamp(n: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return min(hi, max(lo, n))


def classify(signal: Signal, platform_kg: int) -> dict:
    price, arrivals = signal.forecast_price_change_pct, signal.arrival_anomaly_pct
    price_direction = "up" if price > PRICE_THRESHOLD_PCT else "down" if price < -PRICE_THRESHOLD_PCT else "stable"
    # A supply shortfall versus normal means demand is outrunning arrivals.
    trend = "rising" if arrivals <= -ARRIVAL_THRESHOLD_PCT else "falling" if arrivals >= ARRIVAL_THRESHOLD_PCT else "stable"
    platform_boost = min(platform_kg / 1000 / 200, 0.15)
    demand_score = clamp(0.5 + price / 40 - arrivals / 80 + platform_boost)
    demand_level = "high" if demand_score >= 0.62 else "low" if demand_score <= 0.4 else "medium"
    calibrated = clamp(1 - signal.historical_mape_pct / 40, 0.2, 0.95)
    confidence = min(calibrated, FALLBACK_MAX_CONFIDENCE) if signal.fallback else calibrated
    return {
        "demandLevel": demand_level,
        "trend": trend,
        "priceDirection": price_direction,
        "demandScore": demand_score,
        "confidence": js_round(confidence * 100) / 100,
    }


MIN_ZONE_AFFINITY = 0.3


def suitability(crop: dict, season: str, irrigation: str, soil_type: str, zone: str) -> tuple[float, list[dict]]:
    """Agronomic suitability, 0-1, from the crop's fit to the district's
    agro-climatic zone, its water need against the farmer's irrigation, and
    soil. `zone` is the district's zoneKey. Returns 0 when the crop is out of
    season or not grown in that zone. Indicative rules; see tools/build_catalogue.py."""
    affinity = crop.get("zones", {}).get(zone, 0.5)
    if season not in crop["seasons"] or affinity < MIN_ZONE_AFFINITY:
        return 0.0, []
    score = 0.35 + 0.5 * affinity
    notes: list[dict] = []
    if affinity >= 0.9:
        notes.append({"key": "zone_good", "params": {}})
    water = crop.get("water", "medium")
    if water == "high":
        if irrigation == "rainfed" and zone not in crop.get("rainfedOkZones", []):
            score -= 0.3
            notes.append({"key": "irrigation_risk", "params": {}})
        elif irrigation == "drip" and crop["id"] != "rice":
            score += 0.1
    elif water == "low" and irrigation == "rainfed":
        score += 0.05
    if soil_type in crop.get("soils", []):
        score += 0.1
        notes.append({"key": "soil_good", "params": {}})
    elif soil_type in crop.get("avoidSoils", []):
        score -= 0.15
    return js_round(clamp(score) * 100) / 100, notes


def explain(signal: Signal, platform_kg: int, buyers: int, extra: list[dict] | None = None) -> list[dict]:
    """Top drivers as templated sentences; the UI renders `advice.explain.<key>`."""
    drivers: list[tuple[float, dict]] = []
    a = signal.arrival_anomaly_pct
    if abs(a) >= ARRIVAL_THRESHOLD_PCT:
        drivers.append((abs(a), {"key": "arrivals_down" if a < 0 else "arrivals_up", "params": {"pct": js_round(abs(a))}}))
    p = signal.forecast_price_change_pct
    if abs(p) > PRICE_THRESHOLD_PCT:
        drivers.append((abs(p) * 1.5, {"key": "price_up" if p > 0 else "price_down", "params": {"pct": js_round(abs(p))}}))
    if platform_kg > 0:
        tonnes = js_round(platform_kg / 1000)
        drivers.append((12 + tonnes / 10, {"key": "buyers_need", "params": {"buyers": buyers, "tonnes": tonnes, "km": 100}}))
    for d in signal.drivers:  # model-specific drivers (e.g. rainfall) ranked by |SHAP|
        drivers.append((float(d.get("weight", 5)), {"key": d["key"], "params": d.get("params", {})}))
    seen: set[str] = set()
    ranked = []
    for _, e in sorted(drivers, key=lambda x: -x[0]):
        if e["key"] not in seen:
            seen.add(e["key"])
            ranked.append(e)
    out = (ranked + list(extra or []))[:3]
    if not out:
        out.append({"key": "steady", "params": {}})
    if signal.fallback:
        out.append({"key": "fallback", "params": {}})
    return out


def recommend(crops, district_id, season, irrigation, soil_type, zone, signal_for, platform_for, as_of, limit=5) -> list[dict]:
    scored = []
    for crop in crops:
        suit, notes = suitability(crop, season, irrigation, soil_type, zone)
        if suit == 0:
            continue
        signal: Signal = signal_for(crop["id"])
        platform_kg, buyers = platform_for(crop["id"])
        c = classify(signal, platform_kg)
        platform_score = min(platform_kg / 1000 / 100, 1)
        score = 0.5 * suit + 0.35 * c["demandScore"] + 0.15 * platform_score
        scored.append(
            {
                "cropId": crop["id"],
                "districtId": district_id,
                "asOf": as_of,
                "horizonWeeks": signal.horizon_weeks,
                "demandLevel": c["demandLevel"],
                "trend": c["trend"],
                "priceDirection": c["priceDirection"],
                "confidence": c["confidence"],
                "lowConfidenceFallback": signal.fallback,
                "modelVersion": signal.model_version,
                "explanation": explain(signal, platform_kg, buyers, notes),
                "rank": 0,
                "suitability": suit,
                "score": js_round(score * 1000) / 1000,
                "platformDemandKg": platform_kg,
            }
        )
    scored.sort(key=lambda r: (-r["score"], -r["confidence"]))
    top = scored[:limit]
    for i, r in enumerate(top):
        r["rank"] = i + 1
    return top
