// POST /deals, PATCH /deals/{id}/status, GET /deals/{id}, POST /deals/{id}/review.

import { ApiError } from '../../api-error';
import {
  applyAction,
  awaitingParty,
  createDeal as buildDeal,
  DealError,
  releaseQuantity,
  reserveQuantity,
  type ActionInput,
} from '../../deals';
import { sanitizeText } from '../../validation';
import type { Deal, DealAction } from '../../types';
import type { DealView } from '../../views';
import type { MockDb } from '../seed';
import { mutate, newId, readDb } from '../store';
import { audit, companyName, currentUser, delay, notify, nowIso, partyOf, requireVerifiedCompany, toDealView } from './context';

const toApiError = (e: unknown): never => {
  if (e instanceof DealError) throw new ApiError(e.status, e.code);
  throw e;
};

const NOTIFY_TEMPLATE: Record<DealAction, string> = {
  send_offer: 'offer_received',
  counter: 'deal_countered',
  accept: 'deal_accepted',
  reject: 'deal_rejected',
  cancel: 'deal_cancelled',
  complete: 'deal_completed',
};

export async function listMyDeals(): Promise<DealView[]> {
  const db = readDb();
  const me = currentUser(db);
  const mine = db.deals.filter((d) => partyOf(d, me) !== null || me.role === 'admin');
  const views = mine.map((d) => toDealView(db, d, me));
  // Deals waiting on me first, then most recently updated.
  views.sort(
    (a, b) =>
      Number(b.awaiting === b.myParty) - Number(a.awaiting === a.myParty) || b.updatedAt.localeCompare(a.updatedAt),
  );
  return delay(views);
}

export async function getDeal(id: string): Promise<DealView> {
  const db = readDb();
  const me = currentUser(db);
  const deal = db.deals.find((d) => d.id === id);
  // Object-level authorization: only the two parties and admins (Security section 5).
  if (!deal || (partyOf(deal, me) === null && me.role !== 'admin')) throw new ApiError(404, 'not_found');
  return delay(toDealView(db, deal, me));
}

export interface NewDealRequest {
  listingId: string;
  requirementId?: string;
  qtyKg: number;
  pricePerQuintal?: number;
  note?: string;
}

export async function createDeal(input: NewDealRequest): Promise<Deal> {
  const deal = mutate((db) => {
    const me = requireVerifiedCompany(db);
    const listing = db.listings.find((l) => l.id === input.listingId);
    if (!listing) throw new ApiError(404, 'not_found');
    if (input.requirementId && !db.requirements.some((r) => r.id === input.requirementId && r.companyId === me.id)) {
      throw new ApiError(403, 'forbidden');
    }
    const open = db.deals.find(
      (d) => d.listingId === listing.id && d.companyId === me.id && awaitingParty(d) !== null,
    );
    if (open) throw new ApiError(409, 'deal_already_open');
    let created: Deal;
    try {
      created = buildDeal(
        { listing, companyId: me.id, requirementId: input.requirementId, qtyKg: input.qtyKg, pricePerQuintal: input.pricePerQuintal, note: input.note && sanitizeText(input.note) },
        nowIso(),
        () => newId('d'),
      );
    } catch (e) {
      return toApiError(e);
    }
    db.deals.push(created);
    const template = created.status === 'enquiry' ? 'enquiry_received' : 'offer_received';
    notify(db, listing.farmerId, template, { company: companyName(db, me.id), crop: listing.cropId }, `/deals/${created.id}`);
    audit(db, { actorId: me.id, action: 'deal.create', entity: 'deal', entityId: created.id, after: { status: created.status } });
    return created;
  });
  return delay(deal, 250);
}

function applySideEffects(db: MockDb, before: Deal, after: Deal) {
  const listing = db.listings.find((l) => l.id === after.listingId);
  if (!listing) return;
  const i = db.listings.indexOf(listing);
  if (after.status === 'accepted') db.listings[i] = reserveQuantity(listing, after.qtyKg);
  if (after.status === 'cancelled' && before.status === 'accepted') db.listings[i] = releaseQuantity(listing, after.qtyKg);
}

export async function actOnDeal(id: string, input: ActionInput): Promise<DealView> {
  const view = mutate((db) => {
    const me = currentUser(db);
    const index = db.deals.findIndex((d) => d.id === id);
    const deal = db.deals[index];
    const party = deal ? partyOf(deal, me) : null;
    if (!deal || !party) throw new ApiError(404, 'not_found');
    let updated: Deal;
    try {
      updated = applyAction(deal, party, me.id, { ...input, note: input.note && sanitizeText(input.note) }, nowIso(), () => newId('e'));
      applySideEffects(db, deal, updated);
    } catch (e) {
      return toApiError(e);
    }
    db.deals[index] = updated;
    const other = party === 'farmer' ? deal.companyId : deal.farmerId;
    const listing = db.listings.find((l) => l.id === deal.listingId);
    notify(db, other, NOTIFY_TEMPLATE[input.action], { company: companyName(db, deal.companyId), crop: listing?.cropId ?? '' }, `/deals/${id}`);
    audit(db, { actorId: me.id, action: `deal.${input.action}`, entity: 'deal', entityId: id, before: { status: deal.status }, after: { status: updated.status, price: updated.pricePerQuintal } });
    return toDealView(db, updated, me);
  });
  return delay(view, 200);
}

export async function reviewDeal(id: string, rating: number, comment?: string): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(422, 'rating_invalid');
  mutate((db) => {
    const me = currentUser(db);
    const deal = db.deals.find((d) => d.id === id);
    if (!deal || !partyOf(deal, me)) throw new ApiError(404, 'not_found');
    if (deal.status !== 'completed') throw new ApiError(409, 'review_after_completed');
    if (db.reviews.some((r) => r.dealId === id && r.reviewerId === me.id)) throw new ApiError(409, 'already_reviewed');
    db.reviews.push({ id: newId('rev'), dealId: id, reviewerId: me.id, rating, comment: comment ? sanitizeText(comment) : undefined, createdAt: nowIso() });
  });
  return delay(undefined);
}
