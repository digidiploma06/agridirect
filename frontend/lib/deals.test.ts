import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  applyAction,
  awaitingParty,
  createDeal,
  DealError,
  releaseQuantity,
  reserveQuantity,
} from './deals';
import type { Deal, Listing } from './types';

const NOW = '2026-10-25T10:00:00Z';
let n = 0;
const id = () => `id${++n}`;

const listing: Listing = {
  id: 'l1',
  farmerId: 'farmer1',
  cropId: 'maize',
  variety: 'Hybrid',
  qtyKg: 12_000,
  qtyRemainingKg: 12_000,
  readyDate: '2026-11-15',
  location: { lat: 19, lng: 74 },
  districtId: 'd-ahilyanagar',
  village: 'Rahuri',
  quality: {},
  photos: [],
  status: 'active',
  createdAt: NOW,
};

const offer = (): Deal =>
  createDeal({ listing, companyId: 'co1', qtyKg: 5_000, pricePerQuintal: 2100 }, NOW, id);

function expectDealError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DealError);
    expect((e as DealError).status).toBe(status);
    expect((e as DealError).code).toBe(code);
    return;
  }
  throw new Error('expected DealError');
}

describe('createDeal', () => {
  it('opens as an offer when priced, as an enquiry otherwise', () => {
    expect(offer().status).toBe('offer_sent');
    expect(offer().lastOfferBy).toBe('company');
    expect(createDeal({ listing, companyId: 'co1', qtyKg: 1000 }, NOW, id).status).toBe('enquiry');
  });

  it('rejects offers above the remaining quantity or on inactive listings', () => {
    expectDealError(() => createDeal({ listing, companyId: 'c', qtyKg: 13_000 }, NOW, id), 422, 'qty_exceeds_remaining');
    expectDealError(() => createDeal({ listing: { ...listing, status: 'paused' }, companyId: 'c', qtyKg: 1 }, NOW, id), 409, 'listing_not_active');
  });
});

describe('state machine (PRD 7.4)', () => {
  it('only the party receiving the latest offer can accept, counter or reject', () => {
    const d = offer();
    expect(allowedActions(d, 'farmer')).toEqual(['accept', 'counter', 'reject', 'cancel']);
    expect(allowedActions(d, 'company')).toEqual(['cancel']);
    expectDealError(() => applyAction(d, 'company', 'co1', { action: 'accept' }, NOW, id), 403, 'not_your_turn');
  });

  it('a counter flips whose turn it is and requires a price', () => {
    const d = offer();
    expectDealError(() => applyAction(d, 'farmer', 'farmer1', { action: 'counter' }, NOW, id), 422, 'price_required');
    const countered = applyAction(d, 'farmer', 'farmer1', { action: 'counter', pricePerQuintal: 2250 }, NOW, id);
    expect(countered.status).toBe('negotiation');
    expect(countered.pricePerQuintal).toBe(2250);
    expect(awaitingParty(countered)).toBe('company');
    expect(allowedActions(countered, 'company')).toContain('accept');
    expect(countered.events.at(-1)).toMatchObject({ from: 'offer_sent', to: 'negotiation', actorParty: 'farmer' });
  });

  it('enquiry -> offer is the company move; farmer may only cancel', () => {
    const e = createDeal({ listing, companyId: 'co1', qtyKg: 1000 }, NOW, id);
    expect(allowedActions(e, 'farmer')).toEqual(['cancel']);
    const o = applyAction(e, 'company', 'co1', { action: 'send_offer', pricePerQuintal: 2000 }, NOW, id);
    expect(o.status).toBe('offer_sent');
  });

  it('cancellation needs a reason', () => {
    expectDealError(() => applyAction(offer(), 'company', 'co1', { action: 'cancel' }, NOW, id), 422, 'reason_required');
    expect(applyAction(offer(), 'company', 'co1', { action: 'cancel', note: 'Plant shutdown' }, NOW, id).status).toBe('cancelled');
  });

  it('accepted deals can be completed by either side; terminal states allow nothing', () => {
    const accepted = applyAction(offer(), 'farmer', 'farmer1', { action: 'accept' }, NOW, id);
    expect(allowedActions(accepted, 'company')).toEqual(['complete', 'cancel']);
    const done = applyAction(accepted, 'company', 'co1', { action: 'complete' }, NOW, id);
    expect(allowedActions(done, 'farmer')).toEqual([]);
    expect(awaitingParty(done)).toBeNull();
    expectDealError(() => applyAction(done, 'farmer', 'farmer1', { action: 'cancel', note: 'x' }, NOW, id), 409, 'transition_not_allowed');
  });
});

describe('partial fulfilment', () => {
  it('reduces remaining quantity and keeps the listing active while > 0', () => {
    const after = reserveQuantity(listing, 5_000);
    expect(after.qtyRemainingKg).toBe(7_000);
    expect(after.status).toBe('active');
    expect(reserveQuantity(after, 7_000).status).toBe('sold');
    expectDealError(() => reserveQuantity(after, 8_000), 409, 'qty_exceeds_remaining');
  });

  it('release restores quantity and reactivates a sold listing', () => {
    const sold = reserveQuantity(listing, 12_000);
    const back = releaseQuantity(sold, 5_000);
    expect(back).toMatchObject({ qtyRemainingKg: 5_000, status: 'active' });
  });
});
