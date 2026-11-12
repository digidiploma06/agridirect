"""Maps ORM rows to the JSON shapes in frontend/lib/types.ts and views.ts
(camelCase). Privacy rules live here: short names, masked phones, rounded
distances (Security & Privacy sections 2-3)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .domain.deals import allowed_actions, awaiting_party
from .domain.geo import haversine_km, round_to_5km
from .domain.validation import mask_phone
from .models import CompanyProfile, Deal, FarmerProfile, Listing, Requirement, Review, User

PHONE_VISIBLE = ("accepted", "completed")


def _clean(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def user_view(u: User) -> dict:
    return {"id": u.id, "role": u.role, "phone": u.phone, "name": u.name, "language": u.language, "status": u.status, "createdAt": u.created_at}


def farmer_view(f: FarmerProfile) -> dict:
    return {
        "userId": f.user_id,
        "village": f.village,
        "districtId": f.district_id,
        "location": {"lat": f.lat, "lng": f.lng},
        "landAreaAcres": f.land_area_acres,
        "irrigation": f.irrigation,
        "soilType": f.soil_type,
    }


def company_view(c: CompanyProfile) -> dict:
    return _clean(
        {
            "userId": c.user_id,
            "companyName": c.company_name,
            "type": c.type,
            "gstin": c.gstin,
            "operatingDistricts": c.operating_districts or [],
            "contactPerson": c.contact_person,
            "email": c.email,
            "location": {"lat": c.lat, "lng": c.lng},
            "districtId": c.district_id,
            "submittedAt": c.submitted_at,
            "verifiedAt": c.verified_at,
            "rejectionReason": c.rejection_reason,
        }
    )


def session_view(db: Session, u: User) -> dict:
    out = {"user": user_view(u)}
    if u.role == "farmer" and (f := db.get(FarmerProfile, u.id)):
        out["farmer"] = farmer_view(f)
    if u.role == "company" and (c := db.get(CompanyProfile, u.id)):
        out["company"] = company_view(c)
    return out


def short_name(name: str) -> str:
    parts = (name or "").split(" ")
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 and parts[-1] else parts[0]


def viewer_location(db: Session, user: User) -> tuple[float, float] | None:
    if user.role == "company" and (c := db.get(CompanyProfile, user.id)):
        return c.lat, c.lng
    if user.role == "farmer" and (f := db.get(FarmerProfile, user.id)):
        return f.lat, f.lng
    return None


def listing_dict(l: Listing) -> dict:
    return _clean(
        {
            "id": l.id,
            "farmerId": l.farmer_id,
            "cropId": l.crop_id,
            "variety": l.variety,
            "qtyKg": l.qty_kg,
            "qtyRemainingKg": l.qty_remaining_kg,
            "readyDate": l.ready_date,
            "expectedPrice": l.expected_price,
            "location": {"lat": l.lat, "lng": l.lng},
            "districtId": l.district_id,
            "village": l.village,
            "quality": l.quality or {},
            "photos": l.photos or [],
            "status": l.status,
            "hidden": bool(l.hidden),
            "createdAt": l.created_at,
        }
    )


def listing_view(db: Session, l: Listing, viewer: User) -> dict:
    farmer = db.get(User, l.farmer_id)
    is_mine = l.farmer_id == viewer.id
    full = is_mine or viewer.role == "admin"
    out = listing_dict(l)
    out["farmerName"] = (farmer.name if farmer else "") if full else short_name(farmer.name if farmer else "")
    out["isMine"] = is_mine
    if viewer.role == "company" and (loc := viewer_location(db, viewer)):
        out["distanceKm"] = round_to_5km(haversine_km(loc[0], loc[1], l.lat, l.lng))
    return out


def company_name(db: Session, user_id: str) -> str:
    c = db.get(CompanyProfile, user_id)
    return c.company_name if c else ""


def requirement_dict(r: Requirement) -> dict:
    return _clean(
        {
            "id": r.id,
            "companyId": r.company_id,
            "cropId": r.crop_id,
            "qtyKg": r.qty_kg,
            "requiredBy": r.required_by,
            "deliveryLocation": {"lat": r.lat, "lng": r.lng},
            "districtId": r.district_id,
            "priceMin": r.price_min,
            "priceMax": r.price_max,
            "qualitySpec": r.quality_spec or {},
            "notes": r.notes,
            "status": r.status,
            "createdAt": r.created_at,
        }
    )


def requirement_view(db: Session, r: Requirement) -> dict:
    owner = db.get(User, r.company_id)
    return {**requirement_dict(r), "companyName": company_name(db, r.company_id), "companyVerified": bool(owner and owner.status == "verified")}


def live_requirements(db: Session, crop_id: str | None = None) -> list[Requirement]:
    """Requirements that may influence matching and demand: open and from verified companies."""
    q = select(Requirement).join(User, User.id == Requirement.company_id).where(Requirement.status == "open", User.status == "verified", User.role == "company")
    if crop_id:
        q = q.where(Requirement.crop_id == crop_id)
    return list(db.scalars(q).all())


def party_of(deal: Deal, user: User) -> str | None:
    if deal.farmer_id == user.id:
        return "farmer"
    if deal.company_id == user.id:
        return "company"
    return None


def deal_dict(d: Deal) -> dict:
    return _clean(
        {
            "id": d.id,
            "listingId": d.listing_id,
            "requirementId": d.requirement_id,
            "companyId": d.company_id,
            "farmerId": d.farmer_id,
            "qtyKg": d.qty_kg,
            "pricePerQuintal": d.price_per_quintal,
            "status": d.status,
            "lastOfferBy": d.last_offer_by,
            "events": d.events or [],
            "createdAt": d.created_at,
            "updatedAt": d.updated_at,
        }
    )


def deal_view(db: Session, d: Deal, viewer: User) -> dict:
    listing = db.get(Listing, d.listing_id)
    farmer = db.get(User, d.farmer_id)
    company = db.get(User, d.company_id)
    my_party = party_of(d, viewer)
    reveal = d.status in PHONE_VISIBLE or viewer.role == "admin"

    def phone(u: User | None, mine: bool) -> str:
        if not u:
            return ""
        return u.phone if (reveal or mine) else mask_phone(u.phone)

    farmer_name = farmer.name if farmer else ""
    review = db.scalars(select(Review).where(Review.deal_id == d.id, Review.reviewer_id == viewer.id)).first()
    out = deal_dict(d)
    out.update(
        {
            "cropId": listing.crop_id if listing else "maize",
            "listingVariety": listing.variety if listing else "",
            "listingRemainingKg": listing.qty_remaining_kg if listing else 0,
            "companyName": company_name(db, d.company_id),
            "farmerName": farmer_name if (my_party == "farmer" or reveal) else short_name(farmer_name),
            "farmerVillage": listing.village if listing else "",
            "farmerPhone": phone(farmer, my_party == "farmer"),
            "companyPhone": phone(company, my_party == "company"),
            "myParty": my_party,
            "allowed": allowed_actions(d.status, d.last_offer_by, my_party) if my_party else [],
            "awaiting": awaiting_party(d.status, d.last_offer_by),
        }
    )
    if review:
        out["review"] = _clean({"id": review.id, "dealId": review.deal_id, "reviewerId": review.reviewer_id, "rating": review.rating, "comment": review.comment, "createdAt": review.created_at})
    return out
