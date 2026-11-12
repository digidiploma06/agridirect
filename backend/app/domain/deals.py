"""Deal state machine, PRD v1.1 section 7.4.

Statuses: enquiry, offer_sent, negotiation, accepted, rejected, cancelled, completed.
"""
from __future__ import annotations

TERMINAL_STATUSES = ("rejected", "cancelled", "completed")
ACTIONS = ("send_offer", "counter", "accept", "reject", "cancel", "complete")
ACTION_TARGET = {
    "send_offer": "offer_sent",
    "counter": "negotiation",
    "accept": "accepted",
    "reject": "rejected",
    "cancel": "cancelled",
    "complete": "completed",
}


class DealError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def other_party(p: str) -> str:
    return "company" if p == "farmer" else "farmer"


def allowed_actions(status: str, last_offer_by: str | None, party: str) -> list[str]:
    """Which actions this party may take right now."""
    if status == "enquiry":
        return ["send_offer", "cancel"] if party == "company" else ["cancel"]
    if status in ("offer_sent", "negotiation"):
        receiver = other_party(last_offer_by) if last_offer_by else "farmer"
        return ["accept", "counter", "reject", "cancel"] if party == receiver else ["cancel"]
    if status == "accepted":
        return ["complete", "cancel"]
    return []


def awaiting_party(status: str, last_offer_by: str | None) -> str | None:
    """The party whose move it is, or None when nobody is waited on."""
    if status == "enquiry":
        return "company"
    if status in ("offer_sent", "negotiation"):
        return other_party(last_offer_by) if last_offer_by else "farmer"
    return None


def _valid_price(p) -> bool:
    return isinstance(p, int) and not isinstance(p, bool) and p > 0


def apply_action(deal, party: str, actor_id: str, action: str, price, note: str | None, now: str, new_id) -> None:
    """Mutates `deal`. Raises 409 when the transition is not allowed from the
    current status, 403 when it is allowed but not for this party."""
    if action not in allowed_actions(deal.status, deal.last_offer_by, party):
        other_can = action in allowed_actions(deal.status, deal.last_offer_by, other_party(party))
        raise DealError(403 if other_can else 409, "not_your_turn" if other_can else "transition_not_allowed")
    is_offer = action in ("send_offer", "counter")
    if is_offer and not _valid_price(price):
        raise DealError(422, "price_required")
    note = (note or "").strip() or None
    if action == "cancel" and not note:
        raise DealError(422, "reason_required")

    to = ACTION_TARGET[action]
    event = {"id": new_id(), "actorId": actor_id, "actorParty": party, "from": deal.status, "to": to, "at": now}
    if is_offer:
        event["pricePerQuintal"] = price
        deal.price_per_quintal = price
        deal.last_offer_by = party
    if note:
        event["note"] = note
    deal.events = [*deal.events, event]  # reassign so the JSON column is marked dirty
    deal.status = to
    deal.updated_at = now


def validate_new_deal(listing, qty_kg, price) -> str:
    """Returns the opening status. Only companies open deals: an enquiry or a priced offer."""
    if listing.status != "active" or listing.hidden:
        raise DealError(409, "listing_not_active")
    if not isinstance(qty_kg, int) or isinstance(qty_kg, bool) or qty_kg <= 0:
        raise DealError(422, "qty_invalid")
    if qty_kg > listing.qty_remaining_kg:
        raise DealError(422, "qty_exceeds_remaining")
    if price is not None and not _valid_price(price):
        raise DealError(422, "price_required")
    return "enquiry" if price is None else "offer_sent"


def reserve_quantity(listing, qty_kg: int) -> None:
    """Partial fulfilment: on acceptance the listing's remaining quantity is
    reduced; it stays Active while anything remains, otherwise becomes Sold."""
    if qty_kg > listing.qty_remaining_kg:
        raise DealError(409, "qty_exceeds_remaining")
    listing.qty_remaining_kg -= qty_kg
    if listing.qty_remaining_kg <= 0:
        listing.status = "sold"


def release_quantity(listing, qty_kg: int) -> None:
    """Cancelling an Accepted deal puts its quantity back on the listing."""
    listing.qty_remaining_kg = min(listing.qty_kg, listing.qty_remaining_kg + qty_kg)
    if listing.status == "sold":
        listing.status = "active"
