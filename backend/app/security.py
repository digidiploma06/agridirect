"""OTP, JWT and refresh-token helpers (Security & Privacy v1.0 sections 4-5)."""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .domain.dates import now_iso
from .errors import ApiError
from .models import OtpChallenge, RefreshToken

log = logging.getLogger("agridirect.auth")
ALGO = "HS256"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _otp_hash(phone: str, code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def issue_otp(db: Session, phone: str) -> str:
    """Creates a challenge, enforcing max 3 sends per 15 minutes per phone."""
    window_start = _iso(_utcnow() - timedelta(minutes=settings.otp_window_min))
    recent = db.scalars(select(OtpChallenge).where(OtpChallenge.phone == phone, OtpChallenge.created_at >= window_start)).all()
    if len(recent) >= settings.otp_max_sends:
        raise ApiError(429, "otp_rate_limited")
    for old in recent:
        old.used = True  # only the newest code is valid
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        OtpChallenge(
            phone=phone,
            code_hash=_otp_hash(phone, code),
            created_at=now_iso(),
            expires_at=_iso(_utcnow() + timedelta(minutes=settings.otp_ttl_min)),
        )
    )
    return code


def check_otp(db: Session, phone: str, code: str) -> None:
    """Raises otp_expired (410) or otp_invalid (422). Consumes the challenge on success."""
    ch = db.scalars(
        select(OtpChallenge).where(OtpChallenge.phone == phone, OtpChallenge.used.is_(False)).order_by(OtpChallenge.id.desc())
    ).first()
    if ch is None or ch.expires_at < now_iso() or ch.attempts >= settings.otp_max_attempts:
        raise ApiError(410, "otp_expired")
    if not hmac.compare_digest(ch.code_hash, _otp_hash(phone, code)):
        ch.attempts += 1
        db.commit()  # persist the failed attempt even though the request errors
        raise ApiError(422, "otp_invalid")
    ch.used = True


def _encode(payload: dict, ttl: timedelta) -> str:
    now = _utcnow()
    return jwt.encode({**payload, "iat": now, "exp": now + ttl}, settings.jwt_secret, algorithm=ALGO)


def _decode(token: str, typ: str) -> dict:
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    except jwt.PyJWTError as e:
        raise ApiError(401, "unauthenticated") from e
    if data.get("typ") != typ:
        raise ApiError(401, "unauthenticated")
    return data


def create_access_token(user_id: str) -> str:
    return _encode({"sub": user_id, "typ": "access"}, timedelta(minutes=settings.access_ttl_min))


def read_access_token(token: str) -> str:
    return _decode(token, "access")["sub"]


def create_registration_token(phone: str) -> str:
    """Proof that this phone passed OTP; lets a new user finish sign-up."""
    return _encode({"phone": phone, "typ": "register"}, timedelta(minutes=30))


def read_registration_token(token: str) -> str:
    return _decode(token, "register")["phone"]


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_refresh_token(db: Session, user_id: str) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(RefreshToken(token_hash=_hash_token(raw), user_id=user_id, expires_at=_iso(_utcnow() + timedelta(days=settings.refresh_ttl_days))))
    return raw


def rotate_refresh_token(db: Session, raw: str) -> tuple[str, str]:
    """Returns (user_id, new_raw_token); the old token is revoked."""
    row = db.get(RefreshToken, _hash_token(raw)) if raw else None
    if row is None or row.revoked or row.expires_at < now_iso():
        raise ApiError(401, "unauthenticated")
    row.revoked = True
    return row.user_id, create_refresh_token(db, row.user_id)


def revoke_refresh_token(db: Session, raw: str | None) -> None:
    row = db.get(RefreshToken, _hash_token(raw)) if raw else None
    if row:
        row.revoked = True
