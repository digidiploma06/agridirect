"""Data ingestion (TRD section 7.1): mandi prices, weather, soil.

DATA_MODE=synthetic  -> seeded sample data, no network needed.
DATA_MODE=live       -> data.gov.in (Agmarknet) + Open-Meteo + ISRIC SoilGrids.

Every run is recorded in `pipeline_runs`. Live sources are retried with
backoff; if they still fail the run is marked failed and the previously
stored data keeps serving (graceful fallback, PRD section 12).
"""
from __future__ import annotations

import csv
import io
import logging
import time
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from app.catalogue import CROPS, DISTRICTS, MANDIS
from app.config import settings
from app.domain.dates import now_iso, today_iso
from app.models import MarketPrice, PipelineRun, SoilRecord, WeatherRecord

from . import synthetic

log = logging.getLogger("agridirect.ingest")
SOURCES = ("mandi", "weather", "soil")
RETRIES = 3
DATA_GOV_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"  # Current daily price of various commodities from various markets (Mandi)
DATA_GOV_URL = f"https://api.data.gov.in/resource/{DATA_GOV_RESOURCE}"
OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


_CROP_BY_NAME = {_norm(n): c["id"] for c in CROPS for n in [c["id"], *c["agmarknetNames"]]}
_MANDI_BY_NAME = {_norm(n): m["id"] for m in MANDIS for n in [m["id"], m["name"], *m["aliases"]]}


def _chunks(rows: list[dict], size: int = 2000):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def _insert_new_market(db: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    since = min(r["date"] for r in rows)
    existing = set(db.execute(select(MarketPrice.crop_id, MarketPrice.mandi_id, MarketPrice.date).where(MarketPrice.date >= since)).all())
    seen, fresh = set(), []
    for r in rows:
        key = (r["crop_id"], r["mandi_id"], r["date"])
        if key not in existing and key not in seen:
            seen.add(key)
            fresh.append(r)
    for chunk in _chunks(fresh):
        db.execute(insert(MarketPrice), chunk)
    return len(fresh)


def _upsert_weather(db: Session, rows: list[dict]) -> int:
    """Actuals replace earlier forecasts for the same day."""
    if not rows:
        return 0
    since = min(r["date"] for r in rows)
    existing = {(w.district_id, w.date): w for w in db.scalars(select(WeatherRecord).where(WeatherRecord.date >= since)).all()}
    fresh, changed = [], 0
    for r in rows:
        cur = existing.get((r["district_id"], r["date"]))
        if cur is None:
            fresh.append(r)
        elif cur.is_forecast:
            cur.rain_mm, cur.tmax_c, cur.tmin_c, cur.is_forecast, cur.source = r["rain_mm"], r["tmax_c"], r.get("tmin_c"), r["is_forecast"], r["source"]
            changed += 1
    for chunk in _chunks(fresh):
        db.execute(insert(WeatherRecord), chunk)
    return len(fresh) + changed


# --- mandi -------------------------------------------------------------------


def _mandi_synthetic(db: Session) -> tuple[int, str]:
    n = _insert_new_market(db, synthetic.market_rows(date.fromisoformat(today_iso())))
    return n, "Synthetic sample data (not real mandi prices)"


def _parse_date(s: str) -> str | None:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d-%b-%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date().isoformat()
        except (ValueError, AttributeError):
            continue
    return None


def _mandi_live(db: Session) -> tuple[int, str]:
    """Today's Agmarknet prices for Maharashtra from data.gov.in. This resource
    carries prices only (no arrival tonnage) and no history: load history once
    with `python -m ml.pipeline import-csv <file>`."""
    if not settings.data_gov_api_key:
        raise RuntimeError("DATA_GOV_API_KEY is not set (get a free key at data.gov.in and put it in backend/.env)")
    rows, offset = [], 0
    with httpx.Client(timeout=30) as client:
        while True:
            resp = client.get(DATA_GOV_URL, params={"api-key": settings.data_gov_api_key, "format": "json", "limit": 1000, "offset": offset, "filters[state.keyword]": "Maharashtra"})
            resp.raise_for_status()
            records = resp.json().get("records", [])
            for rec in records:
                rec = {k.lower(): v for k, v in rec.items()}
                if _norm(rec.get("state", "maharashtra")) != "maharashtra":
                    continue
                crop, mandi, day = _CROP_BY_NAME.get(_norm(rec.get("commodity", ""))), _MANDI_BY_NAME.get(_norm(rec.get("market", ""))), _parse_date(str(rec.get("arrival_date", "")))
                try:
                    modal = int(float(rec.get("modal_price")))
                    lo, hi = int(float(rec.get("min_price") or modal)), int(float(rec.get("max_price") or modal))
                except (TypeError, ValueError):
                    continue
                if crop and mandi and day and modal > 0:
                    rows.append({"crop_id": crop, "mandi_id": mandi, "date": day, "min_price": lo, "max_price": hi, "modal_price": modal, "arrivals_t": None, "source": "agmarknet"})
            if len(records) < 1000:
                break
            offset += 1000
    return _insert_new_market(db, rows), f"data.gov.in OGD: {len(rows)} pilot rows matched"


def import_market_csv(db: Session, text: str, source: str = "csv") -> int:
    """Admin / CLI upload of historical mandi data (PRD section 15 mitigation).

    Columns (header names are case-insensitive): date | arrival_date,
    crop | commodity, mandi | market, modal_price, and optionally min_price,
    max_price, arrivals_t | arrivals. Dates: YYYY-MM-DD or DD/MM/YYYY.
    Rows for crops or mandis outside the pilot catalogue are skipped."""
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for raw in reader:
        rec = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        crop = _CROP_BY_NAME.get(_norm(rec.get("crop") or rec.get("commodity", "")))
        mandi = _MANDI_BY_NAME.get(_norm(rec.get("mandi") or rec.get("market", "")))
        day = _parse_date(rec.get("date") or rec.get("arrival_date", ""))
        try:
            modal = int(float(rec.get("modal_price", "")))
        except ValueError:
            continue
        if not (crop and mandi and day and modal > 0):
            continue

        def num(key: str, default):
            try:
                return float(rec[key])
            except (KeyError, ValueError):
                return default

        arrivals = num("arrivals_t", num("arrivals", None))
        rows.append({"crop_id": crop, "mandi_id": mandi, "date": day, "min_price": int(num("min_price", modal)), "max_price": int(num("max_price", modal)), "modal_price": modal, "arrivals_t": arrivals, "source": source})
    return _insert_new_market(db, rows)


# --- weather -----------------------------------------------------------------


def _weather_synthetic(db: Session) -> tuple[int, str]:
    n = _upsert_weather(db, synthetic.weather_rows(date.fromisoformat(today_iso())))
    return n, "Synthetic sample data (not real weather)"


def _weather_live(db: Session) -> tuple[int, str]:
    today = date.fromisoformat(today_iso())
    last = db.scalar(select(func.max(WeatherRecord.date)).where(WeatherRecord.is_forecast.is_(False), WeatherRecord.source == "open-meteo"))
    start = date.fromisoformat(last) + timedelta(days=1) if last else today - timedelta(days=365 * 5 + 30)
    end = today - timedelta(days=6)  # ERA5 archive lags about 5 days
    rows = []
    daily = "precipitation_sum,temperature_2m_max,temperature_2m_min"
    with httpx.Client(timeout=60) as client:
        for d in DISTRICTS:
            loc = {"latitude": d["centroid"]["lat"], "longitude": d["centroid"]["lng"], "daily": daily, "timezone": "Asia/Kolkata"}
            calls = [(OPEN_METEO_FORECAST, {**loc, "past_days": 7, "forecast_days": 16}, True)]
            if start <= end:
                calls.insert(0, (OPEN_METEO_ARCHIVE, {**loc, "start_date": start.isoformat(), "end_date": end.isoformat()}, False))
            for url, params, is_forecast_api in calls:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json().get("daily", {})
                for day, rain, tmax, tmin in zip(data.get("time", []), data.get("precipitation_sum", []), data.get("temperature_2m_max", []), data.get("temperature_2m_min", [])):
                    if rain is None or tmax is None:
                        continue
                    rows.append({"district_id": d["id"], "date": day, "rain_mm": float(rain), "tmax_c": float(tmax), "tmin_c": tmin, "is_forecast": is_forecast_api and day > today.isoformat(), "source": "open-meteo"})
    return _upsert_weather(db, rows), "Open-Meteo forecast + archive (ERA5)"


# --- soil --------------------------------------------------------------------


def _store_soil(db: Session, values: dict[str, dict], source: str) -> int:
    for district_id, v in values.items():
        row = db.get(SoilRecord, district_id) or SoilRecord(district_id=district_id, updated_at=now_iso())
        row.ph, row.organic_carbon_g_kg, row.clay_pct, row.texture = v.get("ph"), v.get("organic_carbon_g_kg"), v.get("clay_pct"), v.get("texture")
        row.source, row.updated_at = source, now_iso()
        db.merge(row)
    return len(values)


def _soil_reference(db: Session) -> tuple[int, str]:
    return _store_soil(db, synthetic.REFERENCE_SOIL, "reference"), "Built-in district reference values"


def _soil_live(db: Session) -> tuple[int, str]:
    values = {}
    with httpx.Client(timeout=60) as client:
        for d in DISTRICTS:
            resp = client.get(SOILGRIDS_URL, params={"lon": d["centroid"]["lng"], "lat": d["centroid"]["lat"], "property": ["phh2o", "soc", "clay"], "depth": "0-5cm", "value": "mean"})
            resp.raise_for_status()
            v = {}
            for layer in resp.json().get("properties", {}).get("layers", []):
                mean = (layer.get("depths") or [{}])[0].get("values", {}).get("mean")
                factor = (layer.get("unit_measure") or {}).get("d_factor") or 10
                if mean is None:
                    continue
                key = {"phh2o": "ph", "soc": "organic_carbon_g_kg", "clay": "clay_pct"}.get(layer.get("name"))
                if key:
                    v[key] = round(mean / factor, 2)
            if v:
                clay = v.get("clay_pct")
                v["texture"] = None if clay is None else "clay" if clay >= 40 else "clay loam" if clay >= 27 else "loam"
                values[d["id"]] = v
    if not values:
        raise RuntimeError("SoilGrids returned no values")
    return _store_soil(db, values, "soilgrids"), "ISRIC SoilGrids 250 m (0-5 cm)"


_HANDLERS = {
    ("mandi", "synthetic"): _mandi_synthetic,
    ("mandi", "live"): _mandi_live,
    ("weather", "synthetic"): _weather_synthetic,
    ("weather", "live"): _weather_live,
    ("soil", "synthetic"): _soil_reference,
    ("soil", "live"): _soil_live,
}


def run_source(db: Session, source: str, mode: str | None = None) -> PipelineRun:
    """Runs one source with retries and records the outcome."""
    mode = mode or settings.data_mode
    handler = _HANDLERS[(source, "live" if mode == "live" else "synthetic")]
    run = PipelineRun(source=source, started_at=now_iso(), status="running", records=0)
    db.add(run)
    db.commit()
    error = None
    for attempt in range(1, RETRIES + 1):
        try:
            records, message = handler(db)
            run.status, run.records, run.message = "ok", records, message
            break
        except Exception as e:  # network, quota, parsing ... keep serving stored data
            db.rollback()
            error = e
            log.warning("ingest %s attempt %d/%d failed: %s", source, attempt, RETRIES, e)
            if attempt < RETRIES and mode == "live":
                time.sleep(2**attempt)
            elif mode != "live":
                break
    if run.status != "ok":
        run = db.merge(run)
        run.status, run.message = "failed", f"{type(error).__name__}: {error}"[:300] + f" (after {RETRIES} tries; using stored data)"
        log.error("ALERT: %s ingestion failed: %s", source, error)
    run.finished_at = now_iso()
    db.commit()
    return run
