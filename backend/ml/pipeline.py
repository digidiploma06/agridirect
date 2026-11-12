"""Daily pipeline: ingest -> (retrain if due) -> refresh predictions.

CLI (run from the backend folder):
    python -m ml.pipeline run            ingest all sources and refresh predictions
    python -m ml.pipeline train          retrain now, then refresh predictions
    python -m ml.pipeline import-csv F   load historical mandi prices from a CSV file
    python -m ml.pipeline purge-synthetic  delete synthetic market/weather rows (before going live)
"""
from __future__ import annotations

import logging
import sys
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.catalogue import MANDIS
from app.config import settings
from app.db import SessionLocal, init_db
from app.domain.dates import IST
from app.models import MarketPrice, ModelVersion, PipelineRun, Prediction, WeatherRecord

from .ingest import SOURCES, import_market_csv, run_source
from .predict import refresh_predictions
from .train import NotEnoughData, train

log = logging.getLogger("agridirect.pipeline")
RETRAIN_AFTER_DAYS = 30
_lock = threading.Lock()


def _active(db: Session) -> ModelVersion | None:
    return db.scalars(select(ModelVersion).where(ModelVersion.active.is_(True)).order_by(ModelVersion.trained_at.desc())).first()


def retrain_due(db: Session) -> bool:
    mv = _active(db)
    if mv is None:
        return True
    trained = datetime.strptime(mv.trained_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - trained > timedelta(days=RETRAIN_AFTER_DAYS)


def run_all(db: Session, force_train: bool = False, verbose: bool = False) -> dict:
    """One full pipeline pass. Safe to call from the scheduler, the admin page or the CLI."""
    with _lock:
        runs = {s: run_source(db, s).status for s in SOURCES}
        trained = None
        if force_train or retrain_due(db):
            try:
                trained = train(db, verbose=verbose).version
            except NotEnoughData as e:
                log.warning("training skipped: %s", e)
        n = refresh_predictions(db)
        return {"runs": runs, "trained": trained, "predictions": n}


def bootstrap(verbose: bool = True) -> None:
    """First start: make sure there is data, a model and predictions."""
    with SessionLocal() as db:
        # The sample data is generated from the catalogue. If crops or mandis were
        # added since it was generated, throw it away and rebuild (never touches real data).
        expected = {(c, m["id"]) for m in MANDIS for c in m["crops"]}
        have = set(db.execute(select(MarketPrice.crop_id, MarketPrice.mandi_id).where(MarketPrice.source == "synthetic").distinct()).all())
        if settings.data_mode == "synthetic" and have and have != expected:
            if verbose:
                print("Crop / district catalogue changed: rebuilding sample market data ...", flush=True)
            db.execute(delete(MarketPrice).where(MarketPrice.source == "synthetic"))
            db.execute(delete(WeatherRecord).where(WeatherRecord.source == "synthetic"))
            db.execute(delete(Prediction))
            db.execute(update(ModelVersion).values(active=False))
            db.commit()
        has_data = db.scalar(select(func.count()).select_from(MarketPrice)) or 0
        has_pred = db.scalar(select(func.count()).select_from(Prediction)) or 0
        last_run = db.scalar(select(func.max(PipelineRun.started_at)))
        today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if has_data and has_pred and _active(db) and last_run and last_run[:10] == today_utc:
            return
        if verbose:
            first = not has_data
            print("Preparing market data and price model" + (" (first start, one to two minutes) ..." if first else " ..."), flush=True)
        result = run_all(db, verbose=verbose)
        if verbose:
            print(f"Pipeline: {result}", flush=True)


def _seconds_until_next_run(hour_ist: int = 2) -> float:
    now = datetime.now(IST)
    nxt = now.replace(hour=hour_ist, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


def start_scheduler() -> threading.Thread:
    """Runs the pipeline every day at 02:00 IST while the API process is up."""
    stop = threading.Event()

    def loop():
        while not stop.wait(_seconds_until_next_run()):
            try:
                with SessionLocal() as db:
                    log.info("scheduled pipeline: %s", run_all(db))
            except Exception:
                log.exception("ALERT: scheduled pipeline crashed")

    t = threading.Thread(target=loop, name="agridirect-scheduler", daemon=True)
    t.stop_event = stop  # type: ignore[attr-defined]
    t.start()
    return t


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    init_db()
    cmd = argv[1] if len(argv) > 1 else "run"
    with SessionLocal() as db:
        if cmd == "run":
            print(run_all(db, verbose=True))
        elif cmd == "train":
            print(run_all(db, force_train=True, verbose=True))
        elif cmd == "import-csv" and len(argv) > 2:
            with open(argv[2], encoding="utf-8-sig") as f:
                n = import_market_csv(db, f.read())
            db.commit()
            print(f"Imported {n} new market rows. Now run: python -m ml.pipeline train")
        elif cmd == "purge-synthetic":
            a = db.execute(delete(MarketPrice).where(MarketPrice.source == "synthetic")).rowcount
            b = db.execute(delete(WeatherRecord).where(WeatherRecord.source == "synthetic")).rowcount
            db.execute(delete(Prediction))
            db.commit()
            print(f"Deleted {a} synthetic market rows and {b} synthetic weather rows.")
        else:
            print(__doc__)
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
