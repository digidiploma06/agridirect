"""Environment-based configuration (PRD section 12, Maintainability)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    path = BACKEND_DIR / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


# Serverless hosts (Vercel) give each instance a read-only code folder and a
# small throw-away /tmp. Nothing durable can live on disk there, so the
# database must be an external PostgreSQL and the ML pipeline runs elsewhere.
SERVERLESS = bool(os.environ.get("VERCEL"))
DATA_DIR = Path("/tmp/agridirect") if SERVERLESS else BACKEND_DIR / "data"


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or f"sqlite:///{(DATA_DIR / 'agridirect.db').as_posix()}"
    # Hosted Postgres providers hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver named.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


@dataclass(frozen=True)
class Settings:
    serverless: bool = SERVERLESS
    database_url: str = _database_url()
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-only-change-me-dev-only-change-me")
    access_ttl_min: int = int(os.environ.get("ACCESS_TTL_MIN", "15"))
    refresh_ttl_days: int = int(os.environ.get("REFRESH_TTL_DAYS", "7"))
    otp_mode: str = os.environ.get("OTP_MODE", "demo")
    otp_ttl_min: int = 5
    otp_max_sends: int = 3
    otp_window_min: int = 15
    otp_max_attempts: int = 5
    rate_limit_otp_per_min: int = int(os.environ.get("RATE_LIMIT_OTP_PER_MIN", "20"))
    rate_limit_per_min: int = int(os.environ.get("RATE_LIMIT_PER_MIN", "600"))
    data_mode: str = os.environ.get("DATA_MODE", "synthetic")
    data_gov_api_key: str = os.environ.get("DATA_GOV_API_KEY", "")
    # Ingestion, training and prediction refresh inside the API process. Off on
    # serverless: run `python -m ml.pipeline run` against the same database instead.
    run_pipeline: bool = _bool("RUN_PIPELINE", not SERVERLESS)
    enable_scheduler: bool = _bool("ENABLE_SCHEDULER", not SERVERLESS)
    # "disk": photos saved under data/uploads. "inline": kept in the database row (no writable disk needed).
    photo_storage: str = os.environ.get("PHOTO_STORAGE", "inline" if SERVERLESS else "disk")
    seed_demo: bool = _bool("SEED_DEMO", True)
    cookie_secure: bool = _bool("COOKIE_SECURE", SERVERLESS)
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    )
    upload_dir: Path = DATA_DIR / "uploads"
    model_dir: Path = DATA_DIR / "models"
    privacy_notice_version: str = "demo-2026-10"


settings = Settings()
