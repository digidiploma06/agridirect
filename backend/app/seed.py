"""Fictional demo data (same people and listings as the Phase 0 prototype).
All names, phone numbers and GSTINs are invented. Dates are relative to today
so the walkthrough keeps working on any day."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .domain.dates import add_days, today_iso
from .models import AuditLog, CompanyProfile, Deal, FarmerProfile, Flag, Listing, Notification, Requirement, User


def seed_demo(db: Session) -> bool:
    if db.scalar(select(func.count()).select_from(User)):
        return False
    today = today_iso()

    def t(days: int, hour_ist: float = 10, minute: int = 0) -> str:
        d = datetime.fromisoformat(add_days(today, days)).replace(tzinfo=timezone.utc)
        ts = d + timedelta(hours=hour_ist - 5.5, minutes=minute)
        return ts.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    def d(days: int) -> str:
        return add_days(today, days)

    users = [
        ("u-ramesh", "farmer", "+919800000001", "Ramesh Patil", "mr", "verified", t(-60)),
        ("u-sunita", "farmer", "+919800000002", "Sunita Jadhav", "mr", "verified", t(-45)),
        ("u-vitthal", "farmer", "+919800000003", "Vitthal Shinde", "mr", "verified", t(-40)),
        ("u-anil", "farmer", "+919800000004", "Anil Gaikwad", "hi", "verified", t(-30)),
        ("u-kavita", "farmer", "+919800000005", "Kavita More", "mr", "verified", t(-25)),
        ("u-pvf", "company", "+919800000101", "Sneha Kulkarni", "en", "verified", t(-35)),
        ("u-krishna", "company", "+919800000102", "Rahul Deshmukh", "en", "verified", t(-28)),
        ("u-bhima", "company", "+919800000103", "Prakash Bhosale", "mr", "pending", t(-3)),
        ("u-deccan", "company", "+919800000104", "Ayesha Shaikh", "en", "pending", t(-1)),
        ("u-admin", "admin", "+919800000900", "Operations Admin", "en", "verified", t(-90)),
    ]
    db.add_all(User(id=i, role=r, phone=p, name=n, language=l, status=s, created_at=c) for i, r, p, n, l, s, c in users)
    db.flush()

    farmers = {
        "u-ramesh": ("Rahuri", "d-ahilyanagar", 19.39, 74.65, 4, "well", "black"),
        "u-sunita": ("Junnar", "d-pune", 19.2, 73.88, 6, "canal", "black"),
        "u-vitthal": ("Mohol", "d-solapur", 17.81, 75.64, 8, "borewell", "black"),
        "u-anil": ("Koregaon", "d-satara", 17.7, 74.16, 3, "drip", "red"),
        "u-kavita": ("Niphad", "d-nashik", 20.08, 74.11, 5, "well", "black"),
    }
    db.add_all(FarmerProfile(user_id=u, village=v, district_id=dist, lat=lat, lng=lng, land_area_acres=a, irrigation=irr, soil_type=soil) for u, (v, dist, lat, lng, a, irr, soil) in farmers.items())

    db.add_all(
        [
            CompanyProfile(user_id="u-pvf", company_name="Pune Valley Feeds Pvt Ltd", type="feed", gstin="27AABCP1234Q1Z7", operating_districts=["d-pune", "d-ahilyanagar", "d-satara"], contact_person="Sneha Kulkarni", email="procurement@example.com", lat=18.76, lng=73.86, district_id="d-pune", submitted_at=t(-35), verified_at=t(-33), verified_by="u-admin"),
            CompanyProfile(user_id="u-krishna", company_name="Krishna Agro Processing", type="processor", gstin="27AAGCK5678R1ZH", operating_districts=["d-ahilyanagar", "d-nashik"], contact_person="Rahul Deshmukh", lat=19.12, lng=74.7, district_id="d-ahilyanagar", submitted_at=t(-28), verified_at=t(-27), verified_by="u-admin"),
            CompanyProfile(user_id="u-bhima", company_name="Bhima Oil Extracts", type="processor", gstin="27AACCB9012M1ZK", operating_districts=["d-solapur"], contact_person="Prakash Bhosale", lat=17.68, lng=75.92, district_id="d-solapur", submitted_at=t(-3)),
            CompanyProfile(user_id="u-deccan", company_name="Deccan Fresh Retail", type="retailer", gstin="27AAJFD3456N1ZZ", operating_districts=["d-pune"], contact_person="Ayesha Shaikh", lat=18.56, lng=73.91, district_id="d-pune", submitted_at=t(-1)),
        ]
    )

    def listing(id_, farmer, crop, variety, qty, ready, price, quality, created, remaining=None):
        v, dist, lat, lng, *_ = farmers[farmer]
        return Listing(id=id_, farmer_id=farmer, crop_id=crop, variety=variety, qty_kg=qty, qty_remaining_kg=qty if remaining is None else remaining, ready_date=d(ready), expected_price=price, lat=lat, lng=lng, district_id=dist, village=v, quality=quality, photos=[], status="active", hidden=False, created_at=created)

    db.add_all(
        [
            listing("l-ramesh-maize", "u-ramesh", "maize", "Hybrid yellow", 12_000, 21, 2150, {"grade": "A", "moisturePct": 13}, t(-6)),
            listing("l-ramesh-onion", "u-ramesh", "onion", "Red (N-53)", 8_000, 35, 1700, {"grade": "B"}, t(-4)),
            listing("l-sunita-tomato", "u-sunita", "tomato", "Hybrid round", 5_000, 10, None, {"grade": "A"}, t(-5)),
            listing("l-sunita-maize", "u-sunita", "maize", "Hybrid yellow", 6_000, 3, 2200, {"grade": "A", "moisturePct": 12}, t(-12), remaining=3_000),
            listing("l-vitthal-tur", "u-vitthal", "tur", "BDN-711", 6_000, 40, 7400, {"grade": "A", "moisturePct": 11}, t(-3)),
            listing("l-vitthal-maize", "u-vitthal", "maize", "Local", 20_000, 14, None, {"grade": "B", "moisturePct": 15}, t(-8)),
            listing("l-anil-soybean", "u-anil", "soybean", "JS-335", 4_000, 7, 4700, {"grade": "A", "moisturePct": 10}, t(-7)),
            listing("l-kavita-onion", "u-kavita", "onion", "Red (N-2-4-1)", 15_000, 5, 1600, {"grade": "A"}, t(-2)),
        ]
    )
    db.add_all(
        [
            Requirement(id="r-pvf-maize", company_id="u-pvf", crop_id="maize", qty_kg=50_000, required_by=d(30), lat=18.76, lng=73.86, district_id="d-pune", price_min=2050, price_max=2250, quality_spec={"minGrade": "B", "maxMoisturePct": 14}, notes="Feed grade. Moisture 14% max.", status="open", created_at=t(-10)),
            Requirement(id="r-pvf-soybean", company_id="u-pvf", crop_id="soybean", qty_kg=20_000, required_by=d(20), lat=18.76, lng=73.86, district_id="d-pune", price_min=4400, price_max=4800, quality_spec={"maxMoisturePct": 12}, status="open", created_at=t(-9)),
            Requirement(id="r-krishna-onion", company_id="u-krishna", crop_id="onion", qty_kg=25_000, required_by=d(40), lat=19.12, lng=74.7, district_id="d-ahilyanagar", price_min=1500, price_max=1800, quality_spec={"minGrade": "B"}, notes="For dehydration unit. 45 mm+ bulbs.", status="open", created_at=t(-6)),
            Requirement(id="r-krishna-tomato", company_id="u-krishna", crop_id="tomato", qty_kg=8_000, required_by=d(15), lat=19.12, lng=74.7, district_id="d-ahilyanagar", price_min=1200, price_max=1500, quality_spec={"minGrade": "A"}, status="open", created_at=t(-5)),
        ]
    )
    db.flush()

    def ev(id_, actor, party, frm, to, at, price=None, qty=None, note=None):
        e = {"id": id_, "actorId": actor, "actorParty": party, "from": frm, "to": to, "at": at}
        if price is not None:
            e["pricePerQuintal"] = price
        if qty is not None:
            e["qtyKg"] = qty
        if note:
            e["note"] = note
        return e

    db.add_all(
        [
            Deal(id="deal-sunita-maize", listing_id="l-sunita-maize", requirement_id="r-pvf-maize", company_id="u-pvf", farmer_id="u-sunita", qty_kg=3_000, price_per_quintal=2200, status="accepted", last_offer_by="company", created_at=t(-6, 11), updated_at=t(-4, 16),
                 events=[ev("e1", "u-pvf", "company", None, "offer_sent", t(-6, 11), 2150, 3_000), ev("e2", "u-sunita", "farmer", "offer_sent", "negotiation", t(-5, 9, 30), 2250, note="Moisture is 12%, grade A."), ev("e3", "u-pvf", "company", "negotiation", "negotiation", t(-5, 15), 2200, note="We can pick up from Junnar."), ev("e4", "u-sunita", "farmer", "negotiation", "accepted", t(-4, 16))]),
            Deal(id="deal-ramesh-onion", listing_id="l-ramesh-onion", requirement_id="r-krishna-onion", company_id="u-krishna", farmer_id="u-ramesh", qty_kg=5_000, price_per_quintal=1650, status="offer_sent", last_offer_by="company", created_at=t(-1, 12), updated_at=t(-1, 12),
                 events=[ev("e5", "u-krishna", "company", None, "offer_sent", t(-1, 12), 1650, 5_000, "Pickup from Rahuri by our truck.")]),
            Deal(id="deal-vitthal-maize", listing_id="l-vitthal-maize", requirement_id="r-pvf-maize", company_id="u-pvf", farmer_id="u-vitthal", qty_kg=10_000, status="enquiry", created_at=t(-2, 10), updated_at=t(-2, 10),
                 events=[ev("e6", "u-pvf", "company", None, "enquiry", t(-2, 10), qty=10_000, note="Can you dry to 14% moisture?")]),
            Deal(id="deal-anil-soybean", listing_id="l-anil-soybean", requirement_id="r-pvf-soybean", company_id="u-pvf", farmer_id="u-anil", qty_kg=4_000, price_per_quintal=4300, status="rejected", last_offer_by="company", created_at=t(-5, 10), updated_at=t(-4, 18),
                 events=[ev("e7", "u-pvf", "company", None, "offer_sent", t(-5, 10), 4300, 4_000), ev("e8", "u-anil", "farmer", "offer_sent", "rejected", t(-4, 18), note="Price too low for grade A.")]),
        ]
    )
    db.add_all(
        [
            AuditLog(id="a1", actor_id="u-admin", action="company.verify", entity="company", entity_id="u-pvf", before={"status": "pending"}, after={"status": "verified"}, at=t(-33)),
            AuditLog(id="a2", actor_id="u-admin", action="company.verify", entity="company", entity_id="u-krishna", before={"status": "pending"}, after={"status": "verified"}, at=t(-27)),
            Flag(id="f1", listing_id="l-sunita-tomato", reporter_id="u-krishna", reason="Same listing posted twice with different prices.", status="open", created_at=t(-1, 17)),
            Notification(id="n1", user_id="u-ramesh", template="offer_received", params={"company": "Krishna Agro Processing", "crop": "onion"}, link="/deals/deal-ramesh-onion", read=False, created_at=t(-1, 12)),
            Notification(id="n2", user_id="u-sunita", template="deal_accepted", params={"crop": "maize"}, link="/deals/deal-sunita-maize", read=True, created_at=t(-4, 16)),
        ]
    )
    db.commit()
    return True
