"""Synthetic mandi and weather data for offline development and demos.

THIS IS NOT REAL MARKET DATA. It is a seeded simulation with realistic
structure (seasonality, inflation trend, monsoon-driven supply shocks, prices
reacting to arrivals with a lag) so the whole pipeline -- ingestion, features,
training, validation, prediction -- can run end-to-end without internet access
or API keys. Rows are tagged source="synthetic".

The series start at a fixed epoch and are generated week by week from seeded
random streams, so re-running on a later day extends the same history instead
of producing a different one.
"""
from __future__ import annotations

import math
import zlib
from functools import lru_cache
from datetime import date, timedelta

import numpy as np

from app.catalogue import CROPS, DISTRICTS, MANDIS

EPOCH = date(2021, 1, 4)  # a Monday
FORECAST_DAYS = 14

ANNUAL_TREND = 0.04
CROP_BY_ID = {c["id"]: c for c in CROPS}
ANNUAL_RAIN_MM = {d["id"]: d["annualRainMm"] for d in DISTRICTS}


def _seed(*parts: str) -> int:
    return zlib.crc32(":".join(parts).encode())


def _rng(*parts: str) -> np.random.Generator:
    return np.random.default_rng(_seed(*parts))


@lru_cache(maxsize=None)
def _monsoon_factor(district_id: str, monsoon_year: int) -> float:
    """Year-level monsoon anomaly: shared regional component plus a district one."""
    regional = _rng("monsoon", str(monsoon_year)).standard_normal() * 0.18
    local = _rng("monsoon", district_id, str(monsoon_year)).standard_normal() * 0.12
    return float(np.clip(regional + local, -0.5, 0.6))


def _monsoon_year(d: date) -> int:
    return d.year if d.month >= 6 else d.year - 1


def _rain_profile(doy: int) -> float:
    """Share-of-season shape: south-west monsoon peaking mid-July, small October tail."""
    main = math.exp(-0.5 * ((doy - 205) / 32) ** 2)
    tail = 0.18 * math.exp(-0.5 * ((doy - 285) / 14) ** 2)
    return main + tail


_PROFILE_SUM = sum(_rain_profile(d) for d in range(1, 366))


def weather_rows(today: date) -> list[dict]:
    """Daily rain and temperature per district from EPOCH to today + forecast days."""
    n_days = (today - EPOCH).days + 1 + FORECAST_DAYS
    rows: list[dict] = []
    for dist in DISTRICTS:
        did = dist["id"]
        u_wet = _rng("wet", did).random(n_days)
        z_amt = _rng("amt", did).standard_normal(n_days)
        z_tmp = _rng("tmp", did).standard_normal(n_days)
        for i in range(n_days):
            d = EPOCH + timedelta(days=i)
            doy = d.timetuple().tm_yday
            share = _rain_profile(doy) / _PROFILE_SUM
            factor = 1 + _monsoon_factor(did, _monsoon_year(d))
            expected = ANNUAL_RAIN_MM[did] * share * factor
            p_wet = min(0.85, 0.04 + share * 90)
            rain = 0.0
            if u_wet[i] < p_wet:
                rain = max(0.0, expected / p_wet * math.exp(0.6 * z_amt[i] - 0.18))
            monsoon = _rain_profile(doy)
            tmax = 31.5 + 6.0 * math.cos(2 * math.pi * (doy - 125) / 365) - 4.0 * monsoon + 1.2 * z_tmp[i]
            rows.append(
                {
                    "district_id": did,
                    "date": d.isoformat(),
                    "rain_mm": round(rain, 1),
                    "tmax_c": round(tmax, 1),
                    "tmin_c": round(tmax - 10.5 + 2.5 * monsoon, 1),
                    "is_forecast": d > today,
                    "source": "synthetic",
                }
            )
    return rows


def market_rows(today: date) -> list[dict]:
    """One row per week (dated Monday) per crop x mandi, for the crops commonly
    traded at each mandi, from EPOCH to today."""
    n_weeks = (today - EPOCH).days // 7 + 1
    rows: list[dict] = []
    for mandi in MANDIS:
        mid, did = mandi["id"], mandi["districtId"]
        for crop in mandi["crops"]:
            mk = CROP_BY_ID[crop]["market"]
            base = mk["basePrice"] * (0.94 + _rng("base", crop, mid).random() * 0.12)
            base_arr = mk["baseArrivalsT"] * (0.6 + _rng("basearr", crop, mid).random() * 0.8)
            eps_g = _rng("g", crop, mid).standard_normal(n_weeks)
            eps_u = _rng("u", crop, mid).standard_normal(n_weeks)
            noise = _rng("day", crop, mid).random((n_weeks, 2))
            g_hist: list[float] = []
            g = u = 0.0
            for w in range(n_weeks):
                monday = EPOCH + timedelta(weeks=w)
                woy = monday.isocalendar()[1]
                m = _monsoon_factor(did, _monsoon_year(monday))
                # Supply anomaly: persistent, pushed up after a good monsoon.
                g = 0.90 * g + 0.08 * eps_g[w] + 0.035 * m
                g_hist.append(g)
                lagged = g_hist[max(0, w - 6) : max(1, w - 2)]
                supply = sum(lagged) / len(lagged)
                u = 0.80 * u + mk["weeklySigma"] * eps_u[w]
                seasonal = mk["seasonAmp"] * math.cos(2 * math.pi * (woy - mk["peakWeek"]) / 52)
                price = math.exp(math.log(base) + ANNUAL_TREND * w / 52 + seasonal - mk["supplyBeta"] * supply + u)
                # Arrivals peak when prices are seasonally low (harvest), plus the supply anomaly.
                arrivals = base_arr * math.exp(-1.6 * seasonal + g)
                spread = price * (0.06 + noise[w, 0] * 0.05)
                rows.append(
                    {
                        "crop_id": crop,
                        "mandi_id": mid,
                        "date": monday.isoformat(),
                        "min_price": int(round(price - spread)),
                        "max_price": int(round(price + spread * 0.8)),
                        "modal_price": int(round(price)),
                        "arrivals_t": round(max(0.1, arrivals * (0.9 + noise[w, 1] * 0.2)), 1),
                        "source": "synthetic",
                    }
                )
    return rows


# District-level reference soil values by agro-climatic zone (indicative). Live
# mode replaces these with ISRIC SoilGrids values.
REFERENCE_SOIL = {d["id"]: d["soil"] for d in DISTRICTS}
