"""Calendar helpers. "Today" is the farmer's today (IST), not UTC's."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def today_iso() -> str:
    return datetime.now(IST).date().isoformat()


def add_days(iso_date: str, days: int) -> str:
    return (date.fromisoformat(iso_date) + timedelta(days=days)).isoformat()


def days_between(a: str, b: str) -> int:
    """Whole days from a to b (positive when b is later)."""
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def week_start(iso_date: str) -> str:
    d = date.fromisoformat(iso_date)
    return (d - timedelta(days=d.weekday())).isoformat()


def current_season(iso_date: str) -> str:
    month = int(iso_date[5:7])
    if 6 <= month <= 9:
        return "kharif"
    if 3 <= month <= 5:
        return "zaid"
    return "rabi"


def is_iso_date(value: str) -> bool:
    try:
        return len(value) == 10 and date.fromisoformat(value) is not None
    except (TypeError, ValueError):
        return False
