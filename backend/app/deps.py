"""FastAPI dependencies: authentication and role-based access control."""
from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from .db import get_db
from .errors import ApiError
from .models import AuditLog, Notification, User
from .domain.dates import now_iso
from .security import read_access_token

Db = Annotated[Session, Depends(get_db)]


def new_id(prefix: str = "id") -> str:
    return f"{prefix}-{secrets.token_hex(4)}"


def current_user(db: Db, authorization: Annotated[str | None, Header()] = None) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "unauthenticated")
    user = db.get(User, read_access_token(authorization[7:].strip()))
    if user is None:
        raise ApiError(401, "unauthenticated")
    if user.status == "blocked":
        raise ApiError(403, "blocked")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def require_role(*roles: str):
    def dep(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ApiError(403, "forbidden")
        return user

    return dep


Farmer = Annotated[User, Depends(require_role("farmer"))]
Company = Annotated[User, Depends(require_role("company"))]
Admin = Annotated[User, Depends(require_role("admin"))]


def verified_company(user: Company) -> User:
    if user.status != "verified":
        raise ApiError(403, "company_not_verified")
    return user


VerifiedCompany = Annotated[User, Depends(verified_company)]


def audit(db: Session, actor_id: str, action: str, entity: str, entity_id: str, before=None, after=None, ip: str | None = None) -> None:
    db.add(AuditLog(id=new_id("audit"), actor_id=actor_id, action=action, entity=entity, entity_id=entity_id, before=before, after=after, ip=ip, at=now_iso()))


def notify(db: Session, user_id: str, template: str, params: dict, link: str | None = None) -> None:
    from .sms import send_notification

    db.add(Notification(id=new_id("n"), user_id=user_id, template=template, params=params, link=link, read=False, created_at=now_iso()))
    target = db.get(User, user_id)
    if target:
        send_notification(target.phone, template, params)
