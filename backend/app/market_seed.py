"""Fill an empty database with demo market history, using the API packages only.

The ML pipeline (ml/pipeline.py) is the normal way to get price rows: it
ingests, trains and predicts. It needs numpy, pandas, scikit-learn and
LightGBM, plus a writable disk, so it cannot run on the serverless
deployment -- which is why a freshly deployed site has an empty
`market_prices` table and an empty price chart.

This module is the small substitute for that case. It writes the same seeded
synthetic series the pipeline would ingest (app/synthetic.py), so the charts
have something to draw, and nothing else: no features, no training, no
predictions. The demand outlook keeps using its no-model fallback until the
pipeline runs somewhere that can train.

    python -m app.market_seed                 # two years of weekly rows
    python -m app.market_seed --weeks 260     # five years
    python -m app.market_seed --weather       # weather too (slow; only needed to train)

Set DATABASE_URL first to seed a remote database from your own machine.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from .domain.dates import today_iso
from .models import MarketPrice, WeatherRecord
from .synthetic import market_rows, weather_rows

DEFAULT_WEEKS = 104
CHUNK = 1000


def _chunks(rows: list[dict], size: int = CHUNK):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def seed_market(db: Session, weeks: int = DEFAULT_WEEKS, max_rows: int | None = None) -> tuple[int, int]:
    """Insert the weekly synthetic price rows this database is missing.

    Returns (inserted, still missing). Idempotent: rows already present
    (crop, mandi, date) are left alone, so running it again after a few weeks
    tops the series up instead of duplicating anything.

    Two years over every crop and mandi is tens of thousands of rows, which is
    more than one serverless request should attempt against a remote database.
    `max_rows` caps a single call, and the caller repeats it until nothing is
    missing -- see the admin endpoint.
    """
    rows = market_rows(date.fromisoformat(today_iso()), weeks=weeks)
    if not rows:
        return 0, 0
    since = min(r["date"] for r in rows)
    have = set(db.execute(select(MarketPrice.crop_id, MarketPrice.mandi_id, MarketPrice.date).where(MarketPrice.date >= since)).all())
    missing = [r for r in rows if (r["crop_id"], r["mandi_id"], r["date"]) not in have]
    fresh = missing if max_rows is None else missing[:max_rows]
    for chunk in _chunks(fresh):
        db.execute(insert(MarketPrice), chunk)
    return len(fresh), len(missing) - len(fresh)


def seed_weather(db: Session) -> int:
    """Insert missing daily weather rows. Only training needs these."""
    rows = weather_rows(date.fromisoformat(today_iso()))
    if not rows:
        return 0
    have = set(db.execute(select(WeatherRecord.district_id, WeatherRecord.date)).all())
    fresh = [r for r in rows if (r["district_id"], r["date"]) not in have]
    for chunk in _chunks(fresh):
        db.execute(insert(WeatherRecord), chunk)
    return len(fresh)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--weeks", type=int, default=DEFAULT_WEEKS, help=f"weeks of price history (default {DEFAULT_WEEKS})")
    ap.add_argument("--weather", action="store_true", help="also seed daily weather (slow)")
    args = ap.parse_args(argv)

    from .config import settings
    from .db import SessionLocal, init_db

    init_db()
    print(f"Seeding {settings.database_url.split('@')[-1]}")
    with SessionLocal() as db:
        n, _ = seed_market(db, args.weeks)
        db.commit()
        print(f"  market_prices: {n} new rows")
        if args.weather:
            w = seed_weather(db)
            db.commit()
            print(f"  weather_records: {w} new rows")
    print("Done. This is seeded demo data, not real mandi prices.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
