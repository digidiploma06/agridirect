"""Admin dashboard (FR-04, FR-18..20) and in-app notifications (FR-13)."""
from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Request, Response
from sqlalchemy import func, select

from ..config import settings
from ..db import SessionLocal
from ..deps import Admin, CurrentUser, Db, audit, notify
from ..domain.dates import now_iso
from ..domain.deals import ACTION_TARGET
from ..domain.validation import sanitize_text
from ..errors import ApiError
from ..models import AuditLog, CompanyProfile, Deal, Flag, Listing, Notification, PipelineRun, Requirement, User
from ..schemas import FlagResolve, UserStatusIn, VerifyIn
from ..signals import active_model
from ..views import company_view, deal_view, listing_view, user_view

router = APIRouter(tags=["admin"])
ALL_STATUSES = ["enquiry", "offer_sent", "negotiation", "accepted", "rejected", "cancelled", "completed"]
assert set(ACTION_TARGET.values()) <= set(ALL_STATUSES)


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _flag_views(db, admin: User) -> list[dict]:
    out = []
    for f in db.scalars(select(Flag).where(Flag.status == "open").order_by(Flag.created_at)).all():
        listing = db.get(Listing, f.listing_id)
        if listing is None:
            continue
        reporter = db.get(User, f.reporter_id)
        out.append({"id": f.id, "listingId": f.listing_id, "reporterId": f.reporter_id, "reason": f.reason, "status": f.status, "createdAt": f.created_at, "listing": listing_view(db, listing, admin), "reporterName": reporter.name if reporter else ""})
    return out


@router.get("/admin/overview")
def overview(admin: Admin, db: Db):
    def count(q) -> int:
        return db.scalar(select(func.count()).select_from(q.subquery())) or 0

    by_status = {s: 0 for s in ALL_STATUSES}
    for status, n in db.execute(select(Deal.status, func.count()).group_by(Deal.status)).all():
        by_status[status] = n
    recent = db.scalars(select(Deal).order_by(Deal.updated_at.desc()).limit(6)).all()
    return {
        "farmers": count(select(User.id).where(User.role == "farmer")),
        "companiesVerified": count(select(User.id).where(User.role == "company", User.status == "verified")),
        "companiesPending": count(select(User.id).where(User.role == "company", User.status == "pending")),
        "activeListings": count(select(Listing.id).where(Listing.status == "active", Listing.hidden.is_(False))),
        "openRequirements": count(select(Requirement.id).where(Requirement.status == "open")),
        "dealsByStatus": by_status,
        "recentDeals": [deal_view(db, d, admin) for d in recent],
        "flags": _flag_views(db, admin),
    }


@router.get("/admin/users")
def list_users(admin: Admin, db: Db, role: Optional[str] = None, status: Optional[str] = None):
    q = select(User).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == role)
    if status:
        q = q.where(User.status == status)
    out = []
    for u in db.scalars(q.limit(500)).all():
        item = {"user": user_view(u)}
        if u.role == "company" and (c := db.get(CompanyProfile, u.id)):
            item["company"] = company_view(c)
        out.append(item)
    return out


@router.get("/admin/verifications")
def verifications(admin: Admin, db: Db):
    rows = db.execute(select(User, CompanyProfile).join(CompanyProfile, CompanyProfile.user_id == User.id).where(User.role == "company", User.status == "pending").order_by(CompanyProfile.submitted_at)).all()
    return [{"user": user_view(u), "company": company_view(c)} for u, c in rows]


@router.patch("/admin/users/{user_id}/verify", status_code=204)
def verify_company(user_id: str, body: VerifyIn, admin: Admin, db: Db, request: Request):
    reason = sanitize_text(body.reason)
    if body.decision == "reject" and not reason:
        raise ApiError(422, "reason_required")
    user = db.get(User, user_id)
    company = db.get(CompanyProfile, user_id)
    if user is None or user.role != "company" or company is None:
        raise ApiError(404, "not_found")
    if user.status != "pending":
        raise ApiError(409, "already_decided")
    if body.decision == "approve":
        user.status, company.verified_at, company.verified_by = "verified", now_iso(), admin.id
    else:
        user.status, company.rejection_reason = "rejected", reason
    audit(db, admin.id, "company.verify" if body.decision == "approve" else "company.reject", "company", user_id, before={"status": "pending"}, after={"status": user.status, **({"reason": reason} if reason else {})}, ip=_ip(request))
    notify(db, user_id, "company_verified" if body.decision == "approve" else "company_rejected", {"reason": reason})
    db.commit()


@router.patch("/admin/users/{user_id}/status", status_code=204)
def set_user_status(user_id: str, body: UserStatusIn, admin: Admin, db: Db, request: Request):
    """Block or unblock an account (user management, FR-18)."""
    user = db.get(User, user_id)
    if user is None or user.role == "admin":
        raise ApiError(404, "not_found")
    before = user.status
    user.status = body.status
    audit(db, admin.id, "user.block" if body.status == "blocked" else "user.unblock", "user", user_id, before={"status": before}, after={"status": user.status, "reason": sanitize_text(body.reason) or None}, ip=_ip(request))
    db.commit()


@router.post("/admin/flags/{flag_id}/resolve", status_code=204)
def resolve_flag(flag_id: str, body: FlagResolve, admin: Admin, db: Db, request: Request):
    flag = db.get(Flag, flag_id)
    if flag is None:
        raise ApiError(404, "not_found")
    listing = db.get(Listing, flag.listing_id)
    flag.status = {"dismiss": "dismissed", "hide": "hidden", "block": "blocked"}[body.action]
    if listing and body.action != "dismiss":
        listing.hidden = True
    if listing and body.action == "block":
        if owner := db.get(User, listing.farmer_id):
            owner.status = "blocked"
    audit(db, admin.id, f"flag.{body.action}", "listing", flag.listing_id, after={"flag": flag.status}, ip=_ip(request))
    db.commit()


def ui_metrics(card: dict) -> list[dict]:
    """Rows for the admin 'Data and model health' table."""
    return [
        {"cropId": r["cropId"], "mapeModel": round(r["mapeModel"], 1), "mapeBaseline": round(r["mapeBaseline"], 1), "macroF1": round(r["macroF1"], 2), "macroF1Baseline": round(r["macroF1Baseline"], 2)}
        for r in card.get("perCrop", [])
    ]


def _require_pipeline() -> None:
    """Ingestion and training need the ML packages and a writable disk, which the
    serverless deployment does not have. Run `python -m ml.pipeline` elsewhere."""
    if not settings.run_pipeline:
        raise ApiError(409, "pipeline_external")


def _pipeline_status(db) -> list[dict]:
    out = []
    for source in ("mandi", "weather", "soil"):
        run = db.scalars(select(PipelineRun).where(PipelineRun.source == source).order_by(PipelineRun.id.desc())).first()
        if run is None:
            out.append({"source": source, "lastRunAt": now_iso(), "status": "failed", "records": 0, "message": "Never run"})
        else:
            item = {"source": source, "lastRunAt": run.finished_at or run.started_at, "status": run.status, "records": run.records}
            if run.message:
                item["message"] = run.message
            out.append(item)
    return out


@router.get("/admin/system")
def system_health(admin: Admin, db: Db):
    model = active_model(db)
    card = (model.metrics if model else {}) or {}
    entries = db.scalars(select(AuditLog).order_by(AuditLog.at.desc()).limit(25)).all()
    return {
        "pipeline": _pipeline_status(db),
        "modelVersion": model.version if model else "none",
        "metrics": ui_metrics(card),
        "audit": [{k: v for k, v in {"id": a.id, "actorId": a.actor_id, "action": a.action, "entity": a.entity, "entityId": a.entity_id, "before": a.before, "after": a.after, "at": a.at}.items() if v is not None} for a in entries],
        # Extras beyond the Phase 0 screen: data source, drift and validation detail.
        "dataSource": card.get("dataSource"),
        "trainedAt": card.get("trainedAt"),
        "drift": card.get("drift"),
        "byHorizon": card.get("byHorizon"),
    }


@router.get("/admin/model-card")
def model_card(admin: Admin, db: Db):
    model = active_model(db)
    if model is None:
        raise ApiError(404, "not_found")
    return model.metrics


@router.post("/admin/pipeline/{source}/run", status_code=204)
def run_pipeline(source: str, admin: Admin, db: Db, request: Request):
    """Re-runs one ingestion source now and refreshes predictions."""
    _require_pipeline()
    from ml.ingest import SOURCES, run_source
    from ml.predict import refresh_predictions

    if source not in SOURCES:
        raise ApiError(404, "not_found")
    run_source(db, source)
    refresh_predictions(db)
    audit(db, admin.id, "pipeline.retry", "pipeline", source, ip=_ip(request))
    db.commit()


def _retrain_job() -> None:
    from ml.pipeline import run_all

    with SessionLocal() as session:
        run_all(session, force_train=True)


@router.post("/admin/model/retrain", status_code=202)
def retrain(admin: Admin, db: Db, background: BackgroundTasks, request: Request):
    _require_pipeline()
    audit(db, admin.id, "model.retrain", "model", "price-forecaster", ip=_ip(request))
    db.commit()
    background.add_task(_retrain_job)
    return {"status": "started"}


@router.post("/admin/market/upload")
async def upload_market_csv(request: Request, admin: Admin, db: Db):
    """Manual mandi data upload (text/csv body). See ml/ingest.py for the columns."""
    _require_pipeline()
    from ml.ingest import import_market_csv

    body = await request.body()
    if len(body) > 20 * 1024 * 1024:
        raise ApiError(413, "invalid_request", "CSV larger than 20 MB")
    n = import_market_csv(db, body.decode("utf-8-sig", errors="replace"), source="csv")
    audit(db, admin.id, "market.upload", "market_prices", "csv", after={"rows": n}, ip=_ip(request))
    db.commit()
    return {"inserted": n}


def _csv(rows: list[list], header: list[str], name: str) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for r in rows:
        # Neutralise spreadsheet formulas in user-supplied text.
        w.writerow([f"'{c}" if isinstance(c, str) and c[:1] in "=+-@" else c for c in r])
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/export/deals.csv")
def export_deals(user: CurrentUser, db: Db):
    """Deal history as CSV: your own deals, or all deals for an admin (FR-20)."""
    q = select(Deal).order_by(Deal.created_at)
    if user.role != "admin":
        q = q.where((Deal.farmer_id == user.id) | (Deal.company_id == user.id))
    rows = []
    for d in db.scalars(q).all():
        v = deal_view(db, d, user)
        rows.append([v["id"], v["cropId"], v["listingVariety"], v["qtyKg"], v.get("pricePerQuintal", ""), v["status"], v["farmerName"], v["farmerVillage"], v["companyName"], v["createdAt"], v["updatedAt"]])
    return _csv(rows, ["deal_id", "crop", "variety", "qty_kg", "price_per_quintal", "status", "farmer", "village", "company", "created_at", "updated_at"], "deals.csv")


@router.get("/export/listings.csv")
def export_listings(user: CurrentUser, db: Db):
    """Listings as CSV: your own for a farmer, all for an admin (FR-20)."""
    if user.role not in ("farmer", "admin"):
        raise ApiError(403, "forbidden")
    q = select(Listing).order_by(Listing.created_at)
    if user.role == "farmer":
        q = q.where(Listing.farmer_id == user.id)
    rows = [[l.id, l.crop_id, l.variety, l.qty_kg, l.qty_remaining_kg, l.ready_date, l.expected_price or "", l.district_id, l.village, l.status, l.created_at] for l in db.scalars(q).all()]
    return _csv(rows, ["listing_id", "crop", "variety", "qty_kg", "qty_remaining_kg", "ready_date", "expected_price", "district", "village", "status", "created_at"], "listings.csv")


@router.get("/notifications")
def notifications(user: CurrentUser, db: Db):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(100)).all()
    return [{k: v for k, v in {"id": n.id, "userId": n.user_id, "template": n.template, "params": n.params or {}, "link": n.link, "read": bool(n.read), "createdAt": n.created_at}.items() if v is not None} for n in rows]


@router.post("/notifications/read", status_code=204)
def mark_read(user: CurrentUser, db: Db):
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))).all():
        n.read = True
    db.commit()
