from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres."""
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def js_round(x: float) -> int:
    """Round half up, like JavaScript's Math.round (Python rounds half to even)."""
    return math.floor(x + 0.5)


def round2(x: float) -> float:
    return js_round(x * 100) / 100


def round_to_5km(km: float) -> int:
    """Distances shown to the other party are rounded to 5 km so a farm
    cannot be triangulated (Security & Privacy section 2)."""
    return max(5, js_round(km / 5) * 5)
