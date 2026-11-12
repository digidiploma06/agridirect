"""Field rules from PRD v1.1 section 9. Validators return an error code
(an i18n key under `errors.*` in the frontend) or None when valid."""
from __future__ import annotations

import math
import re

from .geo import js_round

INDIAN_MOBILE = re.compile(r"^[6-9]\d{9}$")
GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
KG_PER_UNIT = {"q": 100, "t": 1000}
MAX_LISTING_KG = 10_000 * 1000
MAX_TEXT = 500
MAX_PHOTOS = 3
MAX_PHOTO_BYTES = 5 * 1024 * 1024
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def normalize_phone(raw: str) -> str | None:
    """Accepts "98765 43210", "+91 9876543210", "09876543210"; returns E.164 or None."""
    digits = re.sub(r"[\s-]", "", raw or "")
    if digits.startswith("+91"):
        digits = digits[3:]
    elif len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return f"+91{digits}" if INDIAN_MOBILE.match(digits) else None


def mask_phone(e164: str) -> str:
    local = re.sub(r"^\+91", "", e164)
    return f"+91 {local[:2]}·····{local[-3:]}"


def validate_otp(code: str) -> str | None:
    return None if re.fullmatch(r"\d{6}", code or "") else "otp_invalid"


def gstin_check_char(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14[:14]):
        product = GSTIN_CHARSET.index(ch) * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return GSTIN_CHARSET[(36 - total % 36) % 36]


def validate_gstin(raw: str) -> str | None:
    gstin = (raw or "").strip().upper()
    if not GSTIN_PATTERN.match(gstin):
        return "gstin_format"
    if gstin_check_char(gstin[:14]) != gstin[14]:
        return "gstin_checksum"
    return None


def to_kg(value: float, unit: str) -> int:
    return js_round(value * KG_PER_UNIT[unit])


def validate_quantity(value: float, unit: str) -> str | None:
    if unit not in KG_PER_UNIT or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        return "qty_positive"
    if to_kg(value, unit) > MAX_LISTING_KG:
        return "qty_max"
    return None


def validate_price(value, required: bool) -> str | None:
    if value is None:
        return "price_required" if required else None
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return "price_integer"
    return None


def validate_price_range(lo, hi) -> str | None:
    return validate_price(lo, True) or validate_price(hi, True) or (None if lo <= hi else "price_range")


def validate_not_past(iso_date: str, today: str) -> str | None:
    from .dates import is_iso_date

    if not isinstance(iso_date, str) or not is_iso_date(iso_date):
        return "date_required"
    return None if iso_date >= today else "date_past"


def sanitize_text(raw: str | None) -> str:
    """Strips HTML tags and caps length (PRD: max 500 chars, HTML stripped)."""
    return re.sub(r"<[^>]*>", "", raw or "").strip()[:MAX_TEXT]


def valid_lat_lng(lat, lng) -> bool:
    return isinstance(lat, (int, float)) and isinstance(lng, (int, float)) and -90 <= lat <= 90 and -180 <= lng <= 180
