"""End-to-end API tests, including the PRD section 14 acceptance flow."""
from datetime import date, timedelta

from .conftest import Api, otp

SOON = (date.today() + timedelta(days=20)).isoformat()
PUNE = {"lat": 18.6, "lng": 73.9}


def test_health_and_public_endpoints(app_client):
    health = app_client.get("/api/v1/health").json()
    assert health["status"] == "ok" and health["persistent"] is True
    snap = app_client.get("/api/v1/market/snapshot").json()
    assert {r["cropId"] for r in snap} == {"onion", "maize", "soybean", "tur", "tomato"}
    cat = app_client.get("/api/v1/catalogue").json()
    assert (len(cat["crops"]), len(cat["districts"]), len(cat["mandis"])) == (20, 36, 34)
    assert app_client.get("/openapi.json").status_code == 200


def test_auth_is_required_and_roles_enforced(app_client, login):
    assert app_client.get("/api/v1/deals").status_code == 401
    assert app_client.get("/api/v1/deals", headers={"Authorization": "Bearer nope"}).json()["code"] == "unauthenticated"
    farmer = login("9800000001")
    assert farmer.get("/admin/overview").json()["code"] == "forbidden"
    assert farmer.get("/listings").status_code == 403  # browse is for companies
    assert login("9800000101").post("/advice/crops", {"districtId": "d-pune", "landAreaAcres": 2, "season": "rabi", "irrigation": "well"}).status_code == 403


def test_otp_rules(app_client):
    phone = "9811111111"
    r = app_client.post("/api/v1/auth/otp/request", json={"phone": "12345"})
    assert (r.status_code, r.json()["code"]) == (422, "phone_invalid")
    code = app_client.post("/api/v1/auth/otp/request", json={"phone": phone}).json()["devOtp"]
    wrong = "000000" if code != "000000" else "111111"
    r = app_client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": wrong})
    assert (r.status_code, r.json()["code"]) == (422, "otp_invalid")
    assert app_client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code}).status_code == 200
    # A code cannot be reused.
    assert app_client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code}).json()["code"] == "otp_expired"
    # Third send inside 15 minutes is allowed, the fourth is not.
    assert app_client.post("/api/v1/auth/otp/request", json={"phone": phone}).status_code == 200
    assert app_client.post("/api/v1/auth/otp/request", json={"phone": phone}).status_code == 200
    r = app_client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert (r.status_code, r.json()["code"]) == (429, "otp_rate_limited")


def test_refresh_and_logout(app_client):
    data = otp(app_client, "9800000002")
    assert data["user"]["name"] == "Sunita Jadhav"
    r = app_client.post("/api/v1/auth/refresh")  # cookie set by verify
    assert r.status_code == 200 and r.json()["session"]["farmer"]["village"] == "Junnar"
    assert app_client.post("/api/v1/auth/logout").status_code == 204
    assert app_client.post("/api/v1/auth/refresh").status_code == 401


def test_privacy_rules(login):
    company = login("9800000102")  # Krishna Agro, has an open offer to Ramesh
    deal = company.get("/deals/deal-ramesh-onion").json()
    assert deal["farmerName"] == "Ramesh P." and "·" in deal["farmerPhone"]  # masked until accepted
    assert deal["companyPhone"] == "+919800000102"
    assert login("9800000101").get("/deals/deal-ramesh-onion").status_code == 404  # not a party
    accepted = login("9800000101").get("/deals/deal-sunita-maize").json()
    assert accepted["farmerPhone"] == "+919800000002" and accepted["farmerName"] == "Sunita Jadhav"
    listing = company.get("/listings/l-ramesh-maize").json()
    assert listing["listing"]["farmerName"] == "Ramesh P." and listing["listing"]["distanceKm"] % 5 == 0
    assert listing["matches"] == []  # matches are for the owner only


def test_unverified_company_cannot_post_or_offer(login):
    pending = login("9800000103")
    body = {"cropId": "soybean", "quantity": 5, "unit": "t", "requiredBy": SOON, "deliveryLocation": PUNE, "districtId": "d-solapur", "priceMin": 4000, "priceMax": 4500}
    assert pending.post("/requirements", body).json()["code"] == "company_not_verified"
    assert pending.post("/deals", {"listingId": "l-anil-soybean", "qtyKg": 1000}).json()["code"] == "company_not_verified"


def test_validation_errors_use_frontend_codes(login):
    farmer = login("9800000003")
    base = {"cropId": "maize", "variety": "x", "quantity": 1, "unit": "t", "readyDate": SOON, "location": PUNE, "districtId": "d-pune", "village": "v", "quality": {}, "photos": []}
    assert farmer.post("/listings", {**base, "cropId": "coconut"}).json()["code"] == "crop_required"
    assert farmer.post("/listings", {**base, "quantity": 0}).json()["code"] == "qty_positive"
    assert farmer.post("/listings", {**base, "quantity": 10001}).json()["code"] == "qty_max"
    assert farmer.post("/listings", {**base, "readyDate": "2020-01-01"}).json()["code"] == "date_past"
    assert farmer.post("/listings", {**base, "photos": ["data:image/gif;base64,R0lGODlh"]}).json()["code"] == "photo_type"
    ok = farmer.post("/listings", {**base, "variety": "<b>Local</b>"})
    assert ok.status_code == 201 and ok.json()["variety"] == "Local" and ok.json()["qtyKg"] == 1000


def test_acceptance_flow(app_client, login):
    """PRD 14: farmer registers, gets crop advice, posts a listing; a verified
    company posts a requirement; a match is suggested; an offer is made and the
    deal is accepted. Quantities follow the PRD section 7 worked example."""
    # 1. New farmer registers.
    v = otp(app_client, "9822222222")
    assert v["user"] is None and v["registrationToken"]
    reg = app_client.post("/api/v1/auth/register", json={"registrationToken": v["registrationToken"], "role": "farmer", "name": "Test Farmer", "language": "mr", "location": PUNE, "districtId": "d-pune", "consentAccount": True, "ageConfirmed": True, "village": "Chakan", "landAreaAcres": 5, "irrigation": "well", "soilType": "black"})
    assert reg.status_code == 200, reg.text
    farmer = Api(app_client, reg.json()["accessToken"])
    assert farmer.get("/auth/session").json()["farmer"]["village"] == "Chakan"

    # 2. Crop advice: ranked, explained, with confidence and a disclaimer.
    advice = farmer.post("/advice/crops", {"districtId": "d-pune", "landAreaAcres": 5, "season": "rabi", "irrigation": "well", "soilType": "black"}).json()
    recs = advice["recommendations"]
    assert [r["rank"] for r in recs] == list(range(1, len(recs) + 1)) and len(recs) >= 3
    assert all(r["explanation"] and 0 < r["confidence"] <= 1 and r["demandLevel"] in ("low", "medium", "high") for r in recs)
    assert advice["modelVersion"].startswith("lgbm-") and "Advisory" in advice["disclaimer"]
    # Advice depends on the district: Konkan and Vidarbha do not get the same list.
    def crops_for(district, season, irrigation):
        r = farmer.post("/advice/crops", {"districtId": district, "landAreaAcres": 5, "season": season, "irrigation": irrigation, "soilType": "black"}).json()
        return [x["cropId"] for x in r["recommendations"]]
    assert crops_for("d-ratnagiri", "kharif", "rainfed")[0] == "rice"
    assert crops_for("d-ratnagiri", "kharif", "rainfed") != crops_for("d-yavatmal", "kharif", "rainfed")
    assert "cotton" in crops_for("d-yavatmal", "kharif", "rainfed")

    # 3. Listing: maize, 10 tonnes, ready in 20 days, with AI insight.
    listing = farmer.post("/listings", {"cropId": "maize", "variety": "Hybrid", "quantity": 10, "unit": "t", "readyDate": SOON, "expectedPrice": 2150, "location": PUNE, "districtId": "d-pune", "village": "Chakan", "quality": {"grade": "A", "moisturePct": 13}, "photos": []}).json()
    detail = farmer.get(f"/listings/{listing['id']}").json()
    assert detail["insight"]["prediction"]["cropId"] == "maize" and detail["insight"]["nearbyBuyers"] >= 1

    # 4. Verified company posts a requirement for 8 tonnes; the listing is the top match.
    company = login("9800000101")
    req = company.post("/requirements", {"cropId": "maize", "quantity": 8, "unit": "t", "requiredBy": (date.today() + timedelta(days=30)).isoformat(), "deliveryLocation": {"lat": 18.76, "lng": 73.86}, "districtId": "d-pune", "priceMin": 2000, "priceMax": 2200, "qualitySpec": {"minGrade": "B"}}).json()
    mine = next(r for r in company.get("/requirements/mine").json() if r["requirement"]["id"] == req["id"])
    assert mine["matches"][0]["listing"]["id"] == listing["id"] and mine["matches"][0]["score"] > 90
    assert farmer.get(f"/matches?listing_id={listing['id']}").json()[0]["requirement"]["companyName"] == "Pune Valley Feeds Pvt Ltd"
    assert any(b["listing"]["id"] == listing["id"] for b in company.get("/listings?cropId=maize&districtId=d-pune").json())

    # 5. Offer -> counter -> accept.
    deal = company.post("/deals", {"listingId": listing["id"], "requirementId": req["id"], "qtyKg": 8000, "pricePerQuintal": 2100, "note": "We require 8 tonnes of maize."}).json()
    assert deal["status"] == "offer_sent"
    assert company.post("/deals", {"listingId": listing["id"], "qtyKg": 1000}).json()["code"] == "deal_already_open"
    assert farmer.get("/notifications").json()[0]["template"] == "offer_received"
    assert company.patch(f"/deals/{deal['id']}/status", {"action": "accept"}).json()["code"] == "not_your_turn"
    countered = farmer.patch(f"/deals/{deal['id']}/status", {"action": "counter", "pricePerQuintal": 2180}).json()
    assert countered["status"] == "negotiation" and countered["awaiting"] == "company"
    accepted = company.patch(f"/deals/{deal['id']}/status", {"action": "accept"}).json()
    assert accepted["status"] == "accepted" and accepted["pricePerQuintal"] == 2180
    assert accepted["farmerPhone"] == "+919822222222"  # revealed on acceptance

    # 6. Remaining 2 tonnes stay listed for other buyers.
    after = farmer.get(f"/listings/{listing['id']}").json()["listing"]
    assert (after["qtyRemainingKg"], after["status"]) == (2000, "active")

    # 7. Complete, review, history and audit trail.
    assert farmer.patch(f"/deals/{deal['id']}/status", {"action": "complete"}).json()["status"] == "completed"
    assert farmer.post(f"/deals/{deal['id']}/review", {"rating": 5, "comment": "Paid on time"}).status_code == 204
    assert farmer.post(f"/deals/{deal['id']}/review", {"rating": 4}).json()["code"] == "already_reviewed"
    history = [e["to"] for e in company.get(f"/deals/{deal['id']}").json()["events"]]
    assert history == ["offer_sent", "negotiation", "accepted", "completed"]
    audit = [a["action"] for a in login("9800000900").get("/admin/system").json()["audit"]]
    assert {"deal.create", "deal.counter", "deal.accept", "deal.complete", "consent.given"} <= set(audit)
    assert "deal_id" in farmer.get("/export/deals.csv").text


def test_admin_verification_and_moderation(app_client, login):
    admin = login("9800000900")
    pending = [v["user"]["id"] for v in admin.get("/admin/verifications").json()]
    assert "u-bhima" in pending
    assert admin.patch("/admin/users/u-deccan/verify", {"decision": "reject"}).json()["code"] == "reason_required"
    assert admin.patch("/admin/users/u-bhima/verify", {"decision": "approve"}).status_code == 204
    assert admin.patch("/admin/users/u-bhima/verify", {"decision": "approve"}).json()["code"] == "already_decided"
    bhima = login("9800000103")
    assert bhima.get("/notifications").json()[0]["template"] == "company_verified"
    body = {"cropId": "soybean", "quantity": 5, "unit": "t", "requiredBy": SOON, "deliveryLocation": {"lat": 17.68, "lng": 75.92}, "districtId": "d-solapur", "priceMin": 4000, "priceMax": 4500}
    assert bhima.post("/requirements", body).status_code == 201

    overview = admin.get("/admin/overview").json()
    assert overview["farmers"] >= 5 and overview["flags"][0]["id"] == "f1"
    assert admin.post("/admin/flags/f1/resolve", {"action": "hide"}).status_code == 204
    assert login("9800000102").get("/listings/l-sunita-tomato").status_code == 404  # hidden from buyers

    # Blocking takes effect on the very next request, even with a valid token.
    kavita = login("9800000005")
    assert admin.patch("/admin/users/u-kavita/status", {"status": "blocked", "reason": "test"}).status_code == 204
    assert kavita.get("/listings/mine").json()["code"] == "blocked"


def test_system_health_and_model_card(login):
    admin = login("9800000900")
    health = admin.get("/admin/system").json()
    assert {p["source"]: p["status"] for p in health["pipeline"]} == {"mandi": "ok", "weather": "ok", "soil": "ok"}
    assert len(health["metrics"]) == 20 and health["dataSource"] == "synthetic"
    card = admin.get("/admin/model-card").json()
    assert card["validation"]["method"] == "rolling-origin walk-forward" and len(card["validation"]["folds"]) == 4
    assert card["overall"]["mapeModel"] < card["overall"]["mapeBaseline"]  # beats seasonal-naive on the sample data
    assert admin.post("/admin/pipeline/soil/run").status_code == 204
    csv_text = "date,commodity,market,min_price,max_price,modal_price\n01/01/2019,Maize,Pune,1500,1700,1600\n01/01/2019,Coconut,Pune,1,2,2\n"
    assert admin.post("/admin/market/upload", content=csv_text).json() == {"inserted": 1}


def test_predictions_and_cold_start(login):
    farmer = login("9800000001")
    p = farmer.get("/predictions/demand?crop=maize&district=d-ahilyanagar").json()
    assert p["lowConfidenceFallback"] is False and p["horizonWeeks"] == 8
    # Mumbai City has no mandi of its own: state-level fallback, capped confidence.
    cold = farmer.get("/predictions/demand?crop=maize&district=d-mumbai-city").json()
    assert cold["lowConfidenceFallback"] is True and cold["confidence"] <= 0.4
    assert cold["explanation"][-1]["key"] == "fallback"
    series = farmer.get("/market/prices?crop=onion&mandi=m-lasalgaon").json()
    assert 50 <= len(series) <= 53 and series[-1]["modalPrice"] > 0


def test_company_signup_photo_upload_and_profile_update(app_client, login):
    import base64

    v = otp(app_client, "9844444444")
    body = {"registrationToken": v["registrationToken"], "role": "company", "name": "Asha Rao", "language": "en", "location": PUNE, "districtId": "d-pune", "consentAccount": True, "ageConfirmed": True, "companyName": "Sahyadri Foods", "type": "processor", "gstin": "27AAPFU0939F1ZX", "operatingDistricts": ["d-pune", "nowhere"]}
    assert app_client.post("/api/v1/auth/register", json=body).json()["code"] == "gstin_checksum"
    assert app_client.post("/api/v1/auth/register", json={**body, "gstin": "27aapfu0939f1zv", "consentAccount": False}).json()["code"] == "consent_required"
    reg = app_client.post("/api/v1/auth/register", json={**body, "gstin": "27aapfu0939f1zv"})
    assert reg.status_code == 200 and reg.json()["user"]["status"] == "pending"  # needs admin verification
    company = Api(app_client, reg.json()["accessToken"])
    session = company.get("/companies/me").json()
    assert session["company"]["gstin"] == "27AAPFU0939F1ZV" and session["company"]["operatingDistricts"] == ["d-pune"]
    assert company.call("PUT", "/companies/me", json={"email": "buy@example.com"}).json()["company"]["email"] == "buy@example.com"
    # The same phone or GSTIN cannot register twice.
    v2 = otp(app_client, "9855555555")
    assert app_client.post("/api/v1/auth/register", json={**body, "registrationToken": v2["registrationToken"], "gstin": "27AAPFU0939F1ZV"}).json()["code"] == "gstin_taken"
    assert app_client.post("/api/v1/auth/register", json={**body, "registrationToken": "forged"}).status_code == 401

    farmer = login("9800000004")
    webp = "data:image/webp;base64," + base64.b64encode(b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 24).decode()
    fake = "data:image/webp;base64," + base64.b64encode(b"<script>alert(1)</script>").decode()
    base = {"cropId": "soybean", "quantity": 2, "unit": "t", "readyDate": SOON, "location": {"lat": 17.7, "lng": 74.16}, "districtId": "d-satara", "village": "Koregaon"}
    assert farmer.post("/listings", {**base, "photos": [fake]}).json()["code"] == "photo_type"  # content is checked, not just the label
    created = farmer.post("/listings", {**base, "photos": [webp]}).json()
    assert created["photos"][0].startswith("/api/v1/uploads/")
    assert app_client.get(created["photos"][0]).status_code == 200
    assert farmer.patch(f"/listings/{created['id']}", {"status": "paused"}).status_code == 204
    assert login("9800000102").get(f"/listings/{created['id']}").status_code == 404  # paused listings are private
    assert farmer.call("PUT", "/farmers/me", json={"landAreaAcres": 3.5}).json()["farmer"]["landAreaAcres"] == 3.5
    assert farmer.call("PUT", "/farmers/me", json={"landAreaAcres": -1}).json()["code"] == "land_area_invalid"
