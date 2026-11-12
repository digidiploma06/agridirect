"""Listings, requirements, matches and produce search (FR-07..11, FR-19)."""
from __future__ import annotations

import base64
import binascii
import secrets
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select

from ..catalogue import get_crop, get_district
from ..config import settings
from ..deps import Company, CurrentUser, Db, Farmer, audit, new_id, require_role
from ..domain.dates import now_iso, today_iso
from ..domain.geo import haversine_km
from ..domain.matching import MAX_RADIUS_KM, matches_for_listing, matches_for_requirement
from ..domain.validation import MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_TYPES, sanitize_text, to_kg, validate_not_past, validate_price, validate_price_range, validate_quantity
from ..errors import ApiError
from ..models import CompanyProfile, Deal, Flag, Listing, Requirement, User
from ..schemas import FlagIn, ListingIn, ListingPatch, RequirementIn, RequirementPatch
from ..signals import platform_demand, prediction_for
from ..views import deal_view, listing_dict, listing_view, live_requirements, requirement_dict, requirement_view

router = APIRouter(tags=["marketplace"])
LISTING_INSIGHT_RADIUS_KM = 50
MAX_LISTINGS_PER_DAY = 10
_MAGIC = {"jpg": (b"\xff\xd8\xff",), "png": (b"\x89PNG\r\n\x1a\n",), "webp": (b"RIFF",)}


def _save_photo(data_url: str) -> str:
    """Stores a `data:image/...;base64,` photo on disk and returns its URL path.
    The browser already re-encodes photos through a canvas, which strips EXIF/GPS."""
    if data_url.startswith("/api/v1/uploads/"):
        return data_url
    if len(data_url) > MAX_PHOTO_BYTES * 2:
        raise ApiError(422, "photo_size")
    try:
        header, b64 = data_url.split(",", 1)
        mime = header.split(";")[0].removeprefix("data:")
        raw = base64.b64decode(b64, validate=True)
    except (ValueError, binascii.Error) as e:
        raise ApiError(422, "photo_type") from e
    ext = PHOTO_TYPES.get(mime)
    if not ext or not any(raw.startswith(m) for m in _MAGIC[ext]):
        raise ApiError(422, "photo_type")
    if len(raw) > MAX_PHOTO_BYTES:
        raise ApiError(422, "photo_size")
    if settings.photo_storage == "inline":
        return data_url  # validated above; stored in the listing row
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(12)}.{ext}"
    (settings.upload_dir / name).write_bytes(raw)
    return f"/api/v1/uploads/{name}"


@router.get("/listings/mine")
def my_listings(user: Farmer, db: Db):
    rows = db.scalars(select(Listing).where(Listing.farmer_id == user.id).order_by(Listing.created_at.desc())).all()
    return [listing_view(db, l, user) for l in rows]


@router.get("/listings")
def browse_listings(
    user: Company,
    db: Db,
    cropId: Optional[str] = None,
    districtId: Optional[str] = None,
    minQtyKg: Optional[int] = None,
    readyBefore: Optional[str] = None,
    radiusKm: Optional[float] = None,
):
    """Search available produce (FR-11). Best matches first, then nearest."""
    me = db.get(CompanyProfile, user.id)
    my_reqs = db.scalars(select(Requirement).where(Requirement.company_id == user.id, Requirement.status == "open")).all()
    radius = radiusKm if radiusKm is not None else MAX_RADIUS_KM
    q = select(Listing).where(Listing.status == "active", Listing.hidden.is_(False), Listing.qty_remaining_kg > 0)
    if cropId:
        q = q.where(Listing.crop_id == cropId)
    if districtId:
        q = q.where(Listing.district_id == districtId)
    if minQtyKg:
        q = q.where(Listing.qty_remaining_kg >= minQtyKg)
    if readyBefore:
        q = q.where(Listing.ready_date <= readyBefore)
    results = []
    for l in db.scalars(q).all():
        if me and haversine_km(me.lat, me.lng, l.lat, l.lng) > radius:
            continue
        best = next(iter(matches_for_listing(l, my_reqs)), None)
        item = {"listing": listing_view(db, l, user)}
        if best:
            item["bestMatch"] = {"requirementId": best["requirementId"], "score": best["score"]}
        results.append(item)
    results.sort(key=lambda r: (-(r.get("bestMatch", {}).get("score", -1)), r["listing"].get("distanceKm", 0)))
    return results[:50]


def _visible_listing(db, listing_id: str, user: User) -> Listing:
    l = db.get(Listing, listing_id)
    visible = l is not None and l.status == "active" and not l.hidden
    if l is None or (l.farmer_id != user.id and user.role != "admin" and not visible):
        raise ApiError(404, "not_found")
    return l


@router.get("/listings/{listing_id}")
def get_listing(listing_id: str, user: CurrentUser, db: Db):
    l = _visible_listing(db, listing_id, user)
    kg, buyers = platform_demand(db, l.crop_id, l.lat, l.lng, LISTING_INSIGHT_RADIUS_KM)
    matches = []
    if l.farmer_id == user.id:
        for m in matches_for_listing(l, live_requirements(db))[:3]:
            matches.append({**m, "requirement": requirement_view(db, db.get(Requirement, m["requirementId"]))})
    deals = db.scalars(select(Deal).where(Deal.listing_id == l.id)).all()
    return {
        "listing": listing_view(db, l, user),
        "insight": {"prediction": prediction_for(db, l.crop_id, l.district_id, (l.lat, l.lng)), "nearbyDemandKg": kg, "nearbyBuyers": buyers, "radiusKm": LISTING_INSIGHT_RADIUS_KM},
        "matches": matches,
        "deals": [deal_view(db, d, user) for d in deals if user.role == "admin" or user.id in (d.farmer_id, d.company_id)],
    }


@router.post("/listings", status_code=201)
def create_listing(body: ListingIn, user: Farmer, db: Db):
    today = today_iso()
    err = (
        (None if get_crop(body.cropId) else "crop_required")
        or validate_quantity(body.quantity, body.unit)
        or validate_not_past(body.readyDate, today)
        or validate_price(body.expectedPrice, False)
        or (None if get_district(body.districtId) else "district_required")
        or (None if len(body.photos) <= MAX_PHOTOS else "photo_count")
    )
    if err:
        raise ApiError(422, err)
    todays = db.scalars(select(Listing).where(Listing.farmer_id == user.id, Listing.created_at >= f"{today}T00:00:00")).all()
    if len(todays) >= MAX_LISTINGS_PER_DAY:
        raise ApiError(429, "listing_limit")
    qty = to_kg(body.quantity, body.unit)
    l = Listing(
        id=new_id("l"),
        farmer_id=user.id,
        crop_id=body.cropId,
        variety=sanitize_text(body.variety),
        qty_kg=qty,
        qty_remaining_kg=qty,
        ready_date=body.readyDate,
        expected_price=body.expectedPrice,
        lat=body.location.lat,
        lng=body.location.lng,
        district_id=body.districtId,
        village=sanitize_text(body.village),
        quality=body.quality.model_dump(exclude_none=True),
        photos=[_save_photo(p) for p in body.photos],
        status="active",
        hidden=False,
        created_at=now_iso(),
    )
    db.add(l)
    db.commit()
    return listing_dict(l)


@router.patch("/listings/{listing_id}", status_code=204)
def set_listing_status(listing_id: str, body: ListingPatch, user: Farmer, db: Db):
    l = db.get(Listing, listing_id)
    if l is None or l.farmer_id != user.id:
        raise ApiError(404, "not_found")
    if l.status in ("sold", "expired"):
        raise ApiError(409, "listing_closed")
    l.status = body.status
    db.commit()


@router.post("/listings/{listing_id}/flag", status_code=204)
def flag_listing(listing_id: str, body: FlagIn, user: CurrentUser, db: Db):
    reason = sanitize_text(body.reason)
    if not reason:
        raise ApiError(422, "reason_required")
    if db.get(Listing, listing_id) is None:
        raise ApiError(404, "not_found")
    db.add(Flag(id=new_id("f"), listing_id=listing_id, reporter_id=user.id, reason=reason, status="open", created_at=now_iso()))
    db.commit()


@router.post("/requirements", status_code=201)
def create_requirement(body: RequirementIn, db: Db, user: User = Depends(require_role("company", "admin"))):
    """Verified companies post requirements. An admin may post on behalf of a
    verified company (PRD section 15, cold-start mitigation)."""
    if user.role == "admin":
        owner = db.get(User, body.companyId or "")
        if owner is None or owner.role != "company":
            raise ApiError(404, "not_found")
    else:
        owner = user
    if owner.status != "verified":
        raise ApiError(403, "company_not_verified")
    err = (
        (None if get_crop(body.cropId) else "crop_required")
        or validate_quantity(body.quantity, body.unit)
        or validate_not_past(body.requiredBy, today_iso())
        or validate_price_range(body.priceMin, body.priceMax)
        or (None if get_district(body.districtId) else "district_required")
    )
    if err:
        raise ApiError(422, err)
    r = Requirement(
        id=new_id("r"),
        company_id=owner.id,
        crop_id=body.cropId,
        qty_kg=to_kg(body.quantity, body.unit),
        required_by=body.requiredBy,
        lat=body.deliveryLocation.lat,
        lng=body.deliveryLocation.lng,
        district_id=body.districtId,
        price_min=body.priceMin,
        price_max=body.priceMax,
        quality_spec=body.qualitySpec.model_dump(exclude_none=True),
        notes=sanitize_text(body.notes) or None,
        status="open",
        created_at=now_iso(),
    )
    db.add(r)
    if user.role == "admin":
        audit(db, user.id, "requirement.create_on_behalf", "requirement", r.id, after={"companyId": owner.id})
    db.commit()
    return requirement_dict(r)


@router.get("/requirements/mine")
def my_requirements(user: Company, db: Db):
    visible = db.scalars(select(Listing).where(Listing.hidden.is_(False))).all()
    reqs = db.scalars(select(Requirement).where(Requirement.company_id == user.id).order_by(Requirement.created_at.desc())).all()
    out = []
    for r in reqs:
        matches = [{**m, "listing": listing_view(db, db.get(Listing, m["listingId"]), user)} for m in matches_for_requirement(r, visible)[:5]]
        out.append({"requirement": requirement_view(db, r), "matches": matches})
    return out


@router.patch("/requirements/{requirement_id}", status_code=204)
def set_requirement_status(requirement_id: str, body: RequirementPatch, user: Company, db: Db):
    r = db.get(Requirement, requirement_id)
    if r is None or r.company_id != user.id:
        raise ApiError(404, "not_found")
    r.status = body.status
    db.commit()


@router.get("/matches")
def matches(user: CurrentUser, db: Db, listing_id: Optional[str] = None, requirement_id: Optional[str] = None):
    """Suggested matches for a listing or a requirement; owner (or admin) only."""
    if listing_id:
        l = db.get(Listing, listing_id)
        if l is None or (l.farmer_id != user.id and user.role != "admin"):
            raise ApiError(404, "not_found")
        return [{**m, "requirement": requirement_view(db, db.get(Requirement, m["requirementId"]))} for m in matches_for_listing(l, live_requirements(db))]
    if requirement_id:
        r = db.get(Requirement, requirement_id)
        if r is None or (r.company_id != user.id and user.role != "admin"):
            raise ApiError(404, "not_found")
        visible = db.scalars(select(Listing).where(Listing.hidden.is_(False))).all()
        return [{**m, "listing": listing_view(db, db.get(Listing, m["listingId"]), user)} for m in matches_for_requirement(r, visible)]
    raise ApiError(422, "invalid_request", "listing_id or requirement_id is required")
