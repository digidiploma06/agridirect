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


@dataclass(frozen=True)
class Settings:
    database_url: str = os.environ.get("DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'data' / 'agridirect.db').as_posix()}")
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
    enable_scheduler: bool = _bool("ENABLE_SCHEDULER", True)
    seed_demo: bool = _bool("SEED_DEMO", True)
    cookie_secure: bool = _bool("COOKIE_SECURE", False)
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    )
    upload_dir: Path = BACKEND_DIR / "data" / "uploads"
    model_dir: Path = BACKEND_DIR / "data" / "models"
    privacy_notice_version: str = "demo-2026-10"


settings = Settings()
