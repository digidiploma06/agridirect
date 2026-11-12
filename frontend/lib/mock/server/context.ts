// Shared helpers for the mock server: auth context, RBAC, view mapping.
// These mirror what the FastAPI dependencies will do server-side.

import { ApiError } from '../../api-error';
import { allowedActions, awaitingParty } from '../../deals';
import { haversineKm, roundTo5Km } from '../../geo';
import { maskPhone } from '../../validation';
import type { AuditEntry, Deal, LatLng, Listing, Party, Requirement, Role, User } from '../../types';
import type { DealView, ListingView, RequirementView } from '../../views';
import type { MockDb } from '../seed';
import { newId } from '../store';

/** Simulated network latency so loading states are visible in the demo. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const nowIso = () => new Date().toISOString();

export function currentUser(db: MockDb): User {
  const user = db.users.find((u) => u.id === db.session.userId);
  if (!user) throw new ApiError(401, 'unauthenticated');
  if (user.status === 'blocked') throw new ApiError(403, 'blocked');
  return user;
}

export function requireRole(db: MockDb, ...roles: Role[]): User {
  const user = currentUser(db);
  if (!roles.includes(user.role)) throw new ApiError(403, 'forbidden');
  return user;
}

export function requireVerifiedCompany(db: MockDb): User {
  const user = requireRole(db, 'company');
  if (user.status !== 'verified') throw new ApiError(403, 'company_not_verified');
  return user;
}

export function audit(db: MockDb, entry: Omit<AuditEntry, 'id' | 'at'>): void {
  db.audit.push({ ...entry, id: newId('audit'), at: nowIso() });
}

export function notify(db: MockDb, userId: string, template: string, params: Record<string, string | number>, link?: string) {
  db.notifications.push({ id: newId('n'), userId, template, params, link, read: false, createdAt: nowIso() });
}

const shortName = (name: string) => {
  const [first, ...rest] = name.split(' ');
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0)}.` : (first ?? '');
};

export function companyName(db: MockDb, userId: string): string {
  return db.companies.find((c) => c.userId === userId)?.companyName ?? '';
}

export function viewerLocation(db: MockDb, user: User): LatLng | undefined {
  if (user.role === 'company') return db.companies.find((c) => c.userId === user.id)?.location;
  if (user.role === 'farmer') return db.farmers.find((f) => f.userId === user.id)?.location;
  return undefined;
}

export function toListingView(db: MockDb, listing: Listing, viewer: User): ListingView {
  const farmer = db.users.find((u) => u.id === listing.farmerId);
  const isMine = listing.farmerId === viewer.id;
  const from = viewer.role === 'company' ? viewerLocation(db, viewer) : undefined;
  return {
    ...listing,
    farmerName: isMine || viewer.role === 'admin' ? (farmer?.name ?? '') : shortName(farmer?.name ?? ''),
    isMine,
    distanceKm: from ? roundTo5Km(haversineKm(from, listing.location)) : undefined,
  };
}

export function toRequirementView(db: MockDb, r: Requirement): RequirementView {
  const owner = db.users.find((u) => u.id === r.companyId);
  return { ...r, companyName: companyName(db, r.companyId), companyVerified: owner?.status === 'verified' };
}

/** Requirements that may influence matching and demand: open and from verified companies. */
export function liveRequirements(db: MockDb): Requirement[] {
  const verified = new Set(db.users.filter((u) => u.role === 'company' && u.status === 'verified').map((u) => u.id));
  return db.requirements.filter((r) => r.status === 'open' && verified.has(r.companyId));
}

export function partyOf(deal: Deal, user: User): Party | null {
  if (deal.farmerId === user.id) return 'farmer';
  if (deal.companyId === user.id) return 'company';
  return null;
}

const PHONE_VISIBLE: Deal['status'][] = ['accepted', 'completed'];

export function toDealView(db: MockDb, deal: Deal, viewer: User): DealView {
  const listing = db.listings.find((l) => l.id === deal.listingId);
  const farmer = db.users.find((u) => u.id === deal.farmerId);
  const company = db.users.find((u) => u.id === deal.companyId);
  const myParty = partyOf(deal, viewer);
  const reveal = PHONE_VISIBLE.includes(deal.status) || viewer.role === 'admin';
  const phone = (u: User | undefined, mine: boolean) => (u ? (reveal || mine ? u.phone : maskPhone(u.phone)) : '');
  return {
    ...deal,
    cropId: listing?.cropId ?? 'maize',
    listingVariety: listing?.variety ?? '',
    listingRemainingKg: listing?.qtyRemainingKg ?? 0,
    companyName: companyName(db, deal.companyId),
    farmerName: myParty === 'farmer' || reveal ? (farmer?.name ?? '') : shortName(farmer?.name ?? ''),
    farmerVillage: listing?.village ?? '',
    farmerPhone: phone(farmer, myParty === 'farmer'),
    companyPhone: phone(company, myParty === 'company'),
    myParty,
    allowed: myParty ? allowedActions(deal, myParty) : [],
    awaiting: awaitingParty(deal),
    review: db.reviews.find((r) => r.dealId === deal.id && r.reviewerId === viewer.id),
  };
}
