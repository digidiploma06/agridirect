"""Core rules: matching score, deal state machine, validators, advice.
Mirrors the frontend unit tests so both implementations stay in step."""
from types import SimpleNamespace as NS

import pytest

from app.domain import advice, deals, matching, validation
from app.domain.dates import add_days, current_season, days_between


def listing(**kw):
    base = dict(id="l1", crop_id="maize", qty_kg=10_000, qty_remaining_kg=10_000, ready_date="2026-11-01", lat=18.52, lng=73.86, quality={"grade": "A", "moisturePct": 12}, status="active", hidden=False)
    return NS(**{**base, **kw})


def requirement(**kw):
    base = dict(id="r1", crop_id="maize", qty_kg=10_000, required_by="2026-11-10", lat=18.52, lng=73.86, quality_spec={"minGrade": "B", "maxMoisturePct": 14}, status="open")
    return NS(**{**base, **kw})


def test_component_scores():
    assert matching.crop_match("maize", "maize") == 1
    assert matching.crop_match("onion", "tomato") == 0.6
    assert matching.crop_match("maize", "soybean") == 0
    assert matching.qty_fit(20_000, 10_000) == 1
    assert matching.qty_fit(2_500, 10_000) == 0.25
    assert matching.qty_fit(1, 0) == 0
    assert matching.distance_score(0) == 1 and matching.distance_score(100) == 0.5 and matching.distance_score(250) == 0
    assert matching.date_fit("2026-11-01", "2026-11-10") == 1
    assert matching.date_fit("2026-11-13", "2026-11-10") == pytest.approx(0.7)
    assert matching.date_fit("2026-12-30", "2026-11-10") == 0
    assert matching.quality_fit({"grade": "B"}, {}) == 1
    assert matching.quality_fit({"grade": "A", "moisturePct": 15}, {"minGrade": "B", "maxMoisturePct": 14}) == 0.5
    assert matching.quality_fit({}, {"minGrade": "C"}) == 0


def test_score_match():
    assert matching.score_match(listing(), requirement())["score"] == 100
    m = matching.score_match(listing(qty_remaining_kg=5_000), requirement())
    assert m["breakdown"]["qty"] == 0.5 and m["score"] == pytest.approx(87.5)
    assert matching.score_match(listing(crop_id="soybean"), requirement()) is None
    assert matching.score_match(listing(lat=21.15, lng=79.09), requirement()) is None  # Nagpur, > 200 km


def test_match_lists_filter_and_sort():
    near = requirement(id="near")
    far = requirement(id="far", lat=19.09, lng=74.74)
    closed = requirement(id="closed", status="closed")
    assert [m["requirementId"] for m in matching.matches_for_listing(listing(), [far, closed, near])] == ["near", "far"]
    assert matching.matches_for_listing(listing(status="paused"), [near]) == []
    assert [m["listingId"] for m in matching.matches_for_requirement(near, [listing(hidden=True), listing(id="ok")])] == ["ok"]


def deal(status="offer_sent", last="company"):
    return NS(status=status, last_offer_by=last, price_per_quintal=2000, events=[], updated_at="")


def act(d, party, action, price=None, note=None):
    deals.apply_action(d, party, "u1", action, price, note, "2026-11-01T00:00:00Z", lambda: "e")
    return d


def test_allowed_actions_by_status_and_party():
    assert deals.allowed_actions("enquiry", None, "company") == ["send_offer", "cancel"]
    assert deals.allowed_actions("enquiry", None, "farmer") == ["cancel"]
    assert deals.allowed_actions("offer_sent", "company", "farmer") == ["accept", "counter", "reject", "cancel"]
    assert deals.allowed_actions("offer_sent", "company", "company") == ["cancel"]
    assert deals.allowed_actions("accepted", "company", "farmer") == ["complete", "cancel"]
    for s in deals.TERMINAL_STATUSES:
        assert deals.allowed_actions(s, "company", "farmer") == []


def test_negotiation_round_trip():
    d = act(deal(), "farmer", "counter", price=2250)
    assert (d.status, d.last_offer_by, d.price_per_quintal) == ("negotiation", "farmer", 2250)
    assert deals.awaiting_party(d.status, d.last_offer_by) == "company"
    d = act(d, "company", "accept")
    assert d.status == "accepted" and d.price_per_quintal == 2250 and len(d.events) == 2
    assert act(d, "farmer", "complete").status == "completed"


def test_transition_errors():
    with pytest.raises(deals.DealError) as e:
        act(deal(), "company", "accept")  # cannot accept your own offer
    assert (e.value.status, e.value.code) == (403, "not_your_turn")
    with pytest.raises(deals.DealError) as e:
        act(deal("completed"), "farmer", "accept")
    assert (e.value.status, e.value.code) == (409, "transition_not_allowed")
    with pytest.raises(deals.DealError) as e:
        act(deal(), "farmer", "counter")
    assert e.value.code == "price_required"
    with pytest.raises(deals.DealError) as e:
        act(deal(), "farmer", "cancel", note="  ")
    assert e.value.code == "reason_required"


def test_new_deal_and_partial_fulfilment():
    l = listing()
    assert deals.validate_new_deal(l, 8_000, None) == "enquiry"
    assert deals.validate_new_deal(l, 8_000, 2100) == "offer_sent"
    with pytest.raises(deals.DealError) as e:
        deals.validate_new_deal(l, 12_000, 2100)
    assert e.value.code == "qty_exceeds_remaining"
    with pytest.raises(deals.DealError) as e:
        deals.validate_new_deal(listing(status="paused"), 1_000, None)
    assert e.value.code == "listing_not_active"
    deals.reserve_quantity(l, 8_000)  # PRD worked example: 10 t listed, 8 t sold
    assert (l.qty_remaining_kg, l.status) == (2_000, "active")
    deals.reserve_quantity(l, 2_000)
    assert (l.qty_remaining_kg, l.status) == (0, "sold")
    deals.release_quantity(l, 2_000)
    assert (l.qty_remaining_kg, l.status) == (2_000, "active")


def test_validators():
    assert validation.normalize_phone("98765 43210") == "+919876543210"
    assert validation.normalize_phone("+91-9876543210") == "+919876543210"
    assert validation.normalize_phone("09876543210") == "+919876543210"
    assert validation.normalize_phone("919876543210") == "+919876543210"
    assert validation.normalize_phone("5876543210") is None and validation.normalize_phone("987654321") is None
    assert validation.mask_phone("+919876543210") == "+91 98·····210"
    assert validation.validate_otp("123456") is None and validation.validate_otp("12a456") == "otp_invalid"
    assert validation.validate_gstin(" 27aapfu0939f1zv ") is None
    assert validation.gstin_check_char("27AAPFU0939F1Z") == "V"
    assert validation.validate_gstin("27AAPFU0939F1ZX") == "gstin_checksum"
    assert validation.validate_gstin("27AAPFU0939F1XV") == "gstin_format"
    assert validation.to_kg(2.5, "q") == 250 and validation.to_kg(8, "t") == 8000
    assert validation.validate_quantity(0, "q") == "qty_positive"
    assert validation.validate_quantity(10_000, "t") is None and validation.validate_quantity(10_000.5, "t") == "qty_max"
    assert validation.validate_price_range(2000, 2200) is None
    assert validation.validate_price_range(2300, 2200) == "price_range"
    assert validation.validate_price_range(20.5, 2200) == "price_integer"
    assert validation.validate_not_past("2026-10-25", "2026-10-25") is None
    assert validation.validate_not_past("2026-10-24", "2026-10-25") == "date_past"
    assert validation.validate_not_past("", "2026-10-25") == "date_required"
    assert validation.sanitize_text("<b>Good</b> maize<script>x</script>") == "Good maizex"
    assert len(validation.sanitize_text("a" * 600)) == 500
    assert add_days("2026-10-30", 3) == "2026-11-02" and days_between("2026-10-25", "2026-11-01") == 7
    assert current_season("2026-07-01") == "kharif" and current_season("2026-10-25") == "rabi"


def test_classify_and_fallback_confidence():
    tight = advice.Signal(9, -18, 8)
    c = advice.classify(tight, 0)
    assert (c["demandLevel"], c["trend"], c["priceDirection"], c["confidence"]) == ("high", "rising", "up", 0.8)
    glut = advice.classify(advice.Signal(-12, 26, 18), 0)
    assert (glut["demandLevel"], glut["trend"], glut["priceDirection"]) == ("low", "falling", "down")
    assert advice.classify(advice.Signal(9, -18, 8, fallback=True), 0)["confidence"] <= advice.FALLBACK_MAX_CONFIDENCE
    # Live buyer demand can lift the level.
    assert advice.classify(advice.Signal(2, 4, 10), 0)["demandLevel"] == "medium"
    assert advice.classify(advice.Signal(4, 0, 10), 40_000)["demandLevel"] == "high"


def test_explanations_and_ranking():
    s = advice.Signal(9, -18, 8, drivers=[{"key": "rain_low", "params": {"pct": 30}, "weight": 50}])
    keys = [e["key"] for e in advice.explain(s, 140_000, 3)]
    assert keys == ["rain_low", "buyers_need", "arrivals_down"]
    assert [e["key"] for e in advice.explain(advice.Signal(0, 0, 10, fallback=True), 0, 0)] == ["steady", "fallback"]

    from app.catalogue import CROPS, get_crop

    signals = {"maize": advice.Signal(9, -18, 8), "onion": advice.Signal(-12, 26, 18)}
    signal_for = lambda c: signals.get(c, advice.Signal(0, 0, 10))  # noqa: E731

    def top(zone, season, irrigation="well", soil="black"):
        return [r["cropId"] for r in advice.recommend(CROPS, "d-x", season, irrigation, soil, zone, signal_for, lambda c: (0, 0), "2026-11-01")]

    ghat_rabi = top("ghat", "rabi")
    assert ghat_rabi[0] == "maize" and len(ghat_rabi) == 5
    assert not {"soybean", "tur", "cotton", "rice"} & set(ghat_rabi)  # kharif-only crops are not offered in rabi
    # The same question gives different crops in different agro-climatic zones.
    assert top("konkan", "kharif", "rainfed", "laterite")[0] == "rice"
    assert {"cotton", "tur"} <= set(top("central", "kharif", "rainfed"))
    assert "cotton" not in top("konkan", "kharif") and "rice" not in top("scarcity", "kharif")
    recs = advice.recommend(CROPS, "d-x", "rabi", "well", "black", "ghat", signal_for, lambda c: (0, 0), "2026-11-01")
    assert [r["rank"] for r in recs] == [1, 2, 3, 4, 5]


def test_suitability_rules():
    from app.catalogue import get_crop

    onion, rice, jowar = get_crop("onion"), get_crop("rice"), get_crop("jowar")
    assert advice.suitability(onion, "zaid", "well", "black", "ghat") == (0.0, [])  # out of season
    assert advice.suitability(rice, "kharif", "canal", "alluvial", "scarcity") == (0.0, [])  # not grown in that zone
    score, notes = advice.suitability(onion, "rabi", "rainfed", "red", "scarcity")
    assert score == 0.55 and [n["key"] for n in notes] == ["zone_good", "irrigation_risk"]
    assert advice.suitability(onion, "rabi", "drip", "black", "scarcity")[0] == 1.0
    # Rain-fed paddy is normal on the Konkan coast, so no irrigation penalty there.
    assert "irrigation_risk" not in [n["key"] for n in advice.suitability(rice, "kharif", "rainfed", "laterite", "konkan")[1]]
    assert advice.suitability(jowar, "rabi", "rainfed", "black", "scarcity")[0] == 1.0
    assert advice.suitability(jowar, "rabi", "well", "laterite", "scarcity")[0] == 0.7
