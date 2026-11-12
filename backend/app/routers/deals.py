"""Deal workflow (FR-12) and reviews (FR-17). Every status change is audited."""
from __future__ import annotations

from fastapi import APIRouter, Request
from sqlalchemy import select

from ..deps import CurrentUser, Db, VerifiedCompany, audit, new_id, notify
from ..domain.dates import now_iso
from ..domain.deals import DealError, apply_action, awaiting_party, release_quantity, reserve_quantity, validate_new_deal
from ..domain.validation import sanitize_text
from ..errors import ApiError
from ..models import Deal, Listing, Requirement, Review
from ..schemas import DealAction, DealIn, ReviewIn
from ..views import company_name, deal_dict, deal_view, party_of

router = APIRouter(tags=["deals"])
NOTIFY_TEMPLATE = {"send_offer": "offer_received", "counter": "deal_countered", "accept": "deal_accepted", "reject": "deal_rejected", "cancel": "deal_cancelled", "complete": "deal_completed"}


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/deals")
def my_deals(user: CurrentUser, db: Db):
    q = select(Deal)
    if user.role != "admin":
        q = q.where((Deal.farmer_id == user.id) | (Deal.company_id == user.id))
    views = [deal_view(db, d, user) for d in db.scalars(q).all()]
    # Deals waiting on me first, then most recently updated.
    views.sort(key=lambda v: v["updatedAt"], reverse=True)
    views.sort(key=lambda v: 0 if (v["awaiting"] is not None and v["awaiting"] == v["myParty"]) else 1)
    return views


@router.get("/deals/{deal_id}")
def get_deal(deal_id: str, user: CurrentUser, db: Db):
    d = db.get(Deal, deal_id)
    # Object-level authorization: only the two parties and admins (Security section 5).
    if d is None or (party_of(d, user) is None and user.role != "admin"):
        raise ApiError(404, "not_found")
    return deal_view(db, d, user)


@router.post("/deals", status_code=201)
def create_deal(body: DealIn, user: VerifiedCompany, db: Db, request: Request):
    listing = db.get(Listing, body.listingId)
    if listing is None:
        raise ApiError(404, "not_found")
    if body.requirementId:
        r = db.get(Requirement, body.requirementId)
        if r is None or r.company_id != user.id:
            raise ApiError(403, "forbidden")
    existing = db.scalars(select(Deal).where(Deal.listing_id == listing.id, Deal.company_id == user.id)).all()
    if any(awaiting_party(d.status, d.last_offer_by) is not None for d in existing):
        raise ApiError(409, "deal_already_open")
    try:
        status = validate_new_deal(listing, body.qtyKg, body.pricePerQuintal)
    except DealError as e:
        raise ApiError(e.status, e.code) from e
    now = now_iso()
    event = {"id": new_id("e"), "actorId": user.id, "actorParty": "company", "from": None, "to": status, "qtyKg": body.qtyKg, "at": now}
    if body.pricePerQuintal is not None:
        event["pricePerQuintal"] = body.pricePerQuintal
    if note := sanitize_text(body.note):
        event["note"] = note
    d = Deal(
        id=new_id("d"),
        listing_id=listing.id,
        requirement_id=body.requirementId,
        company_id=user.id,
        farmer_id=listing.farmer_id,
        qty_kg=body.qtyKg,
        price_per_quintal=body.pricePerQuintal,
        status=status,
        last_offer_by="company" if status == "offer_sent" else None,
        events=[event],
        created_at=now,
        updated_at=now,
    )
    db.add(d)
    notify(db, listing.farmer_id, "enquiry_received" if status == "enquiry" else "offer_received", {"company": company_name(db, user.id), "crop": listing.crop_id}, f"/deals/{d.id}")
    audit(db, user.id, "deal.create", "deal", d.id, after={"status": status}, ip=_ip(request))
    db.commit()
    return deal_dict(d)


@router.patch("/deals/{deal_id}/status")
def act_on_deal(deal_id: str, body: DealAction, user: CurrentUser, db: Db, request: Request):
    d = db.get(Deal, deal_id)
    party = party_of(d, user) if d else None
    if d is None or party is None:
        raise ApiError(404, "not_found")
    before = d.status
    listing = db.get(Listing, d.listing_id)
    try:
        apply_action(d, party, user.id, body.action, body.pricePerQuintal, sanitize_text(body.note), now_iso(), lambda: new_id("e"))
        if listing is not None:
            if d.status == "accepted":
                reserve_quantity(listing, d.qty_kg)
            elif d.status == "cancelled" and before == "accepted":
                release_quantity(listing, d.qty_kg)
    except DealError as e:
        db.rollback()
        raise ApiError(e.status, e.code) from e
    other = d.company_id if party == "farmer" else d.farmer_id
    notify(db, other, NOTIFY_TEMPLATE[body.action], {"company": company_name(db, d.company_id), "crop": listing.crop_id if listing else ""}, f"/deals/{d.id}")
    audit(db, user.id, f"deal.{body.action}", "deal", d.id, before={"status": before}, after={"status": d.status, "price": d.price_per_quintal}, ip=_ip(request))
    db.commit()
    return deal_view(db, d, user)


@router.post("/deals/{deal_id}/review", status_code=204)
def review_deal(deal_id: str, body: ReviewIn, user: CurrentUser, db: Db):
    if not (1 <= body.rating <= 5):
        raise ApiError(422, "rating_invalid")
    d = db.get(Deal, deal_id)
    if d is None or party_of(d, user) is None:
        raise ApiError(404, "not_found")
    if d.status != "completed":
        raise ApiError(409, "review_after_completed")
    if db.scalars(select(Review).where(Review.deal_id == deal_id, Review.reviewer_id == user.id)).first():
        raise ApiError(409, "already_reviewed")
    db.add(Review(id=new_id("rev"), deal_id=deal_id, reviewer_id=user.id, rating=body.rating, comment=sanitize_text(body.comment) or None, created_at=now_iso()))
    db.commit()
