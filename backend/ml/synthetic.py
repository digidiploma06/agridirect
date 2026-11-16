"""Synthetic mandi and weather data (see app/synthetic.py).

The generator itself lives in `app` so the serverless deployment, which has no
ML packages, can still seed a database. This module keeps the historical import
path (`ml.synthetic`) working for the pipeline and the tests.
"""
from __future__ import annotations

from app.synthetic import (  # noqa: F401
    ANNUAL_RAIN_MM,
    ANNUAL_TREND,
    CROP_BY_ID,
    EPOCH,
    FORECAST_DAYS,
    REFERENCE_SOIL,
    market_rows,
    weather_rows,
)

__all__ = [
    "ANNUAL_RAIN_MM",
    "ANNUAL_TREND",
    "CROP_BY_ID",
    "EPOCH",
    "FORECAST_DAYS",
    "REFERENCE_SOIL",
    "market_rows",
    "weather_rows",
]
