// Deal state machine, PRD v1.1 section 7.4. Pure functions: the mock API
// (and later the FastAPI service) call these and persist the result.

import type { Deal, DealAction, DealEvent, DealStatus, Listing, Party } from './types';

export const TERMINAL_STATUSES: readonly DealStatus[] = ['rejected', 'cancelled', 'completed'];

const ACTION_TARGET: Record<DealAction, DealStatus> = {
  send_offer: 'offer_sent',
  counter: 'negotiation',
  accept: 'accepted',
  reject: 'rejected',
  cancel: 'cancelled',
  complete: 'completed',
};

/** Error codes mirror the HTTP status the API returns (TRD section 6.2). */
export class DealError extends Error {
  constructor(
    public readonly status: 403 | 409 | 422,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'DealError';
  }
}

const otherParty = (p: Party): Party => (p === 'farmer' ? 'company' : 'farmer');

export function isTerminal(status: DealStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Which actions this party may take right now. */
export function allowedActions(deal: Pick<Deal, 'status' | 'lastOfferBy'>, party: Party): DealAction[] {
  switch (deal.status) {
    case 'enquiry':
      return party === 'company' ? ['send_offer', 'cancel'] : ['cancel'];
    case 'offer_sent':
    case 'negotiation': {
      const receiver = deal.lastOfferBy ? otherParty(deal.lastOfferBy) : 'farmer';
      return party === receiver ? ['accept', 'counter', 'reject', 'cancel'] : ['cancel'];
    }
    case 'accepted':
      return ['complete', 'cancel'];
    default:
      return [];
  }
}

export interface ActionInput {
  action: DealAction;
  pricePerQuintal?: number;
  note?: string;
}

function validateInput(input: ActionInput) {
  const needsPrice = input.action === 'send_offer' || input.action === 'counter';
  if (needsPrice) {
    const p = input.pricePerQuintal;
    if (p === undefined || !Number.isInteger(p) || p <= 0) throw new DealError(422, 'price_required');
  }
  if (input.action === 'cancel' && !input.note?.trim()) throw new DealError(422, 'reason_required');
}

/**
 * Apply an action and return the updated deal. Throws 409 when the
 * transition is not allowed from the current status, 403 when it is allowed
 * but not for this party (e.g. countering your own offer).
 */
export function applyAction(
  deal: Deal,
  party: Party,
  actorId: string,
  input: ActionInput,
  now: string,
  newId: () => string,
): Deal {
  if (!allowedActions(deal, party).includes(input.action)) {
    const otherCan = allowedActions(deal, otherParty(party)).includes(input.action);
    throw new DealError(otherCan ? 403 : 409, otherCan ? 'not_your_turn' : 'transition_not_allowed');
  }
  validateInput(input);

  const to = ACTION_TARGET[input.action];
  const isOffer = input.action === 'send_offer' || input.action === 'counter';
  const event: DealEvent = {
    id: newId(),
    actorId,
    actorParty: party,
    from: deal.status,
    to,
    pricePerQuintal: isOffer ? input.pricePerQuintal : undefined,
    note: input.note?.trim() || undefined,
    at: now,
  };
  return {
    ...deal,
    status: to,
    pricePerQuintal: isOffer ? input.pricePerQuintal : deal.pricePerQuintal,
    lastOfferBy: isOffer ? party : deal.lastOfferBy,
    events: [...deal.events, event],
    updatedAt: now,
  };
}

export interface NewDealInput {
  listing: Listing;
  companyId: string;
  requirementId?: string;
  qtyKg: number;
  /** Omit for an enquiry; set to open with an offer. */
  pricePerQuintal?: number;
  note?: string;
}

/** Only companies open deals: either an enquiry or a priced offer. */
export function createDeal(input: NewDealInput, now: string, newId: () => string): Deal {
  const { listing, qtyKg, pricePerQuintal } = input;
  if (listing.status !== 'active' || listing.hidden) throw new DealError(409, 'listing_not_active');
  if (!Number.isInteger(qtyKg) || qtyKg <= 0) throw new DealError(422, 'qty_invalid');
  if (qtyKg > listing.qtyRemainingKg) throw new DealError(422, 'qty_exceeds_remaining');
  if (pricePerQuintal !== undefined && (!Number.isInteger(pricePerQuintal) || pricePerQuintal <= 0)) {
    throw new DealError(422, 'price_required');
  }

  const to: DealStatus = pricePerQuintal === undefined ? 'enquiry' : 'offer_sent';
  return {
    id: newId(),
    listingId: listing.id,
    requirementId: input.requirementId,
    companyId: input.companyId,
    farmerId: listing.farmerId,
    qtyKg,
    pricePerQuintal,
    status: to,
    lastOfferBy: to === 'offer_sent' ? 'company' : undefined,
    events: [
      {
        id: newId(),
        actorId: input.companyId,
        actorParty: 'company',
        from: null,
        to,
        pricePerQuintal,
        qtyKg,
        note: input.note?.trim() || undefined,
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Partial fulfilment: on acceptance the listing's remaining quantity is
 * reduced; it stays Active while anything remains, otherwise becomes Sold.
 */
export function reserveQuantity(listing: Listing, qtyKg: number): Listing {
  if (qtyKg > listing.qtyRemainingKg) throw new DealError(409, 'qty_exceeds_remaining');
  const remaining = listing.qtyRemainingKg - qtyKg;
  return { ...listing, qtyRemainingKg: remaining, status: remaining > 0 ? listing.status : 'sold' };
}

/** Cancelling an Accepted deal puts its quantity back on the listing. */
export function releaseQuantity(listing: Listing, qtyKg: number): Listing {
  const remaining = Math.min(listing.qtyKg, listing.qtyRemainingKg + qtyKg);
  return { ...listing, qtyRemainingKg: remaining, status: listing.status === 'sold' ? 'active' : listing.status };
}

/** The party whose move it is, or null when nobody is waited on. */
export function awaitingParty(deal: Pick<Deal, 'status' | 'lastOfferBy'>): Party | null {
  if (deal.status === 'enquiry') return 'company';
  if (deal.status === 'offer_sent' || deal.status === 'negotiation') {
    return deal.lastOfferBy ? otherParty(deal.lastOfferBy) : 'farmer';
  }
  return null;
}
