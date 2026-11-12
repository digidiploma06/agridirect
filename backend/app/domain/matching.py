"""Rule-based matching engine, TRD v1.0 section 7.5.

score = 100 x (0.30 crop + 0.25 qty + 0.20 distance + 0.15 date + 0.10 quality)
Only pairs with crop_match > 0 and distance <= 200 km are scored.
"""
from __future__ import annotations

from ..catalogue import get_crop
from .dates import days_between
from .geo import haversine_km, round2

MAX_RADIUS_KM = 200
WEIGHTS = {"crop": 0.3, "qty": 0.25, "distance": 0.2, "date": 0.15, "quality": 0.1}
SAME_FAMILY_CROP_MATCH = 0.6
LATE_DECAY_PER_DAY = 0.1
GRADE_RANK = {"A": 3, "B": 2, "C": 1}


def crop_match(a: str, b: str) -> float:
    if a == b:
        return 1.0
    ca, cb = get_crop(a), get_crop(b)
    return SAME_FAMILY_CROP_MATCH if ca and cb and ca["family"] == cb["family"] else 0.0


def qty_fit(listing_qty_kg: int, req_qty_kg: int) -> float:
    return 0.0 if req_qty_kg <= 0 else min(listing_qty_kg, req_qty_kg) / req_qty_kg


def distance_score(km: float, max_radius_km: float = MAX_RADIUS_KM) -> float:
    return max(0.0, 1 - km / max_radius_km)


def date_fit(ready_date: str, required_by: str) -> float:
    """1 if ready on or before required-by; otherwise decays 0.1 per day late."""
    days_late = days_between(required_by, ready_date)
    return 1.0 if days_late <= 0 else max(0.0, 1 - LATE_DECAY_PER_DAY * days_late)


def quality_fit(quality: dict, spec: dict) -> float:
    """Share of the requirement's quality specs the listing satisfies (1 when none are set)."""
    checks: list[bool] = []
    if spec.get("minGrade") is not None:
        grade = quality.get("grade")
        checks.append(grade is not None and GRADE_RANK.get(grade, 0) >= GRADE_RANK.get(spec["minGrade"], 99))
    if spec.get("maxMoisturePct") is not None:
        moisture = quality.get("moisturePct")
        checks.append(moisture is not None and moisture <= spec["maxMoisturePct"])
    return 1.0 if not checks else sum(checks) / len(checks)


def is_live(listing) -> bool:
    return listing.status == "active" and not listing.hidden and listing.qty_remaining_kg > 0


def score_match(listing, requirement) -> dict | None:
    crop = crop_match(listing.crop_id, requirement.crop_id)
    km = haversine_km(listing.lat, listing.lng, requirement.lat, requirement.lng)
    if crop == 0 or km > MAX_RADIUS_KM:
        return None
    breakdown = {
        "crop": crop,
        "qty": qty_fit(listing.qty_remaining_kg, requirement.qty_kg),
        "distance": distance_score(km),
        "date": date_fit(listing.ready_date, requirement.required_by),
        "quality": quality_fit(listing.quality or {}, requirement.quality_spec or {}),
    }
    weighted = sum(WEIGHTS[k] * breakdown[k] for k in WEIGHTS)
    return {
        "listingId": listing.id,
        "requirementId": requirement.id,
        "score": round2(100 * weighted),
        "breakdown": breakdown,
        "distanceKm": round2(km),
    }


def _by_score(m: dict):
    return (-m["score"], m["distanceKm"])


def matches_for_listing(listing, requirements) -> list[dict]:
    if not is_live(listing):
        return []
    scored = (score_match(listing, r) for r in requirements if r.status == "open")
    return sorted((m for m in scored if m), key=_by_score)


def matches_for_requirement(requirement, listings) -> list[dict]:
    if requirement.status != "open":
        return []
    scored = (score_match(l, requirement) for l in listings if is_live(l))
    return sorted((m for m in scored if m), key=_by_score)
