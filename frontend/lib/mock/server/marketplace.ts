// Listings, requirements, matches and produce search (TRD section 6).

import { ApiError } from '../../api-error';
import { todayIso } from '../../dates';
import { haversineKm } from '../../geo';
import { matchesForListing, matchesForRequirement, MAX_RADIUS_KM } from '../../matching';
import type { CropId, LatLng, Listing, ListingQuality, QtyUnit, QualitySpec, Requirement } from '../../types';
import {
  MAX_PHOTOS,
  sanitizeText,
  toKg,
  validateNotPast,
  validatePrice,
  validatePriceRange,
  validateQuantity,
} from '../../validation';
import type {
  BrowseFilters,
  BrowseResult,
  ListingDetail,
  ListingMatch,
  ListingView,
  RequirementMatch,
  RequirementWithMatches,
} from '../../views';
import { getCrop, getDistrict } from '../catalogue';
import { mutate, newId, readDb } from '../store';
import {
  currentUser,
  delay,
  liveRequirements,
  nowIso,
  requireRole,
  requireVerifiedCompany,
  toDealView,
  toListingView,
  toRequirementView,
} from './context';
import { platformDemand, predictionFor } from './insights';

const LISTING_INSIGHT_RADIUS_KM = 50;
const MAX_LISTINGS_PER_DAY = 10;

export async function listMyListings(): Promise<ListingView[]> {
  const db = readDb();
  const me = requireRole(db, 'farmer');
  const mine = db.listings.filter((l) => l.farmerId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(mine.map((l) => toListingView(db, l, me)));
}

export async function getListing(id: string): Promise<ListingDetail> {
  const db = readDb();
  const me = currentUser(db);
  const listing = db.listings.find((l) => l.id === id);
  const visibleToOthers = listing && listing.status === 'active' && !listing.hidden;
  if (!listing || (listing.farmerId !== me.id && me.role !== 'admin' && !visibleToOthers)) {
    throw new ApiError(404, 'not_found');
  }
  const nearby = platformDemand(db, listing.cropId, listing.location, LISTING_INSIGHT_RADIUS_KM);
  const matches: ListingMatch[] = matchesForListing(listing, liveRequirements(db))
    .slice(0, 3)
    .map((m) => ({ ...m, requirement: toRequirementView(db, db.requirements.find((r) => r.id === m.requirementId)!) }));
  const deals = db.deals
    .filter((d) => d.listingId === id && (d.farmerId === me.id || d.companyId === me.id || me.role === 'admin'))
    .map((d) => toDealView(db, d, me));
  return delay({
    listing: toListingView(db, listing, me),
    insight: {
      prediction: predictionFor(db, listing.cropId, listing.districtId, listing.location),
      nearbyDemandKg: nearby.kg,
      nearbyBuyers: nearby.buyers,
      radiusKm: LISTING_INSIGHT_RADIUS_KM,
    },
    matches: listing.farmerId === me.id ? matches : [],
    deals,
  });
}

export interface NewListingInput {
  cropId: CropId;
  variety: string;
  quantity: number;
  unit: QtyUnit;
  readyDate: string;
  expectedPrice?: number;
  location: LatLng;
  districtId: string;
  village: string;
  quality: ListingQuality;
  photos: string[];
}

export async function createListing(input: NewListingInput): Promise<Listing> {
  const err =
    (getCrop(input.cropId) ? null : 'crop_required') ??
    validateQuantity(input.quantity, input.unit) ??
    validateNotPast(input.readyDate, todayIso()) ??
    validatePrice(input.expectedPrice, false) ??
    (getDistrict(input.districtId) ? null : 'district_required') ??
    (input.photos.length <= MAX_PHOTOS ? null : 'photo_count');
  if (err) throw new ApiError(422, err);

  const listing = mutate((db) => {
    const me = requireRole(db, 'farmer');
    const today = todayIso();
    const todays = db.listings.filter((l) => l.farmerId === me.id && l.createdAt.slice(0, 10) === today);
    if (todays.length >= MAX_LISTINGS_PER_DAY) throw new ApiError(429, 'listing_limit');
    const qtyKg = toKg(input.quantity, input.unit);
    const created: Listing = {
      id: newId('l'),
      farmerId: me.id,
      cropId: input.cropId,
      variety: sanitizeText(input.variety),
      qtyKg,
      qtyRemainingKg: qtyKg,
      readyDate: input.readyDate,
      expectedPrice: input.expectedPrice,
      location: input.location,
      districtId: input.districtId,
      village: sanitizeText(input.village),
      quality: input.quality,
      photos: input.photos,
      status: 'active',
      createdAt: nowIso(),
    };
    db.listings.push(created);
    return created;
  });
  return delay(listing, 250);
}

export async function setListingStatus(id: string, status: 'active' | 'paused'): Promise<void> {
  mutate((db) => {
    const me = requireRole(db, 'farmer');
    const listing = db.listings.find((l) => l.id === id && l.farmerId === me.id);
    if (!listing) throw new ApiError(404, 'not_found');
    if (listing.status === 'sold' || listing.status === 'expired') throw new ApiError(409, 'listing_closed');
    listing.status = status;
  });
  return delay(undefined);
}

export interface NewRequirementInput {
  cropId: CropId;
  quantity: number;
  unit: QtyUnit;
  requiredBy: string;
  deliveryLocation: LatLng;
  districtId: string;
  priceMin: number;
  priceMax: number;
  qualitySpec: QualitySpec;
  notes?: string;
}

export async function createRequirement(input: NewRequirementInput): Promise<Requirement> {
  const err =
    (getCrop(input.cropId) ? null : 'crop_required') ??
    validateQuantity(input.quantity, input.unit) ??
    validateNotPast(input.requiredBy, todayIso()) ??
    validatePriceRange(input.priceMin, input.priceMax) ??
    (getDistrict(input.districtId) ? null : 'district_required');
  if (err) throw new ApiError(422, err);

  const requirement = mutate((db) => {
    const me = requireVerifiedCompany(db);
    const created: Requirement = {
      id: newId('r'),
      companyId: me.id,
      cropId: input.cropId,
      qtyKg: toKg(input.quantity, input.unit),
      requiredBy: input.requiredBy,
      deliveryLocation: input.deliveryLocation,
      districtId: input.districtId,
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      qualitySpec: input.qualitySpec,
      notes: input.notes ? sanitizeText(input.notes) : undefined,
      status: 'open',
      createdAt: nowIso(),
    };
    db.requirements.push(created);
    return created;
  });
  return delay(requirement, 250);
}

export async function listMyRequirements(): Promise<RequirementWithMatches[]> {
  const db = readDb();
  const me = requireRole(db, 'company');
  const visible = db.listings.filter((l) => !l.hidden);
  const result = db.requirements
    .filter((r) => r.companyId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      requirement: toRequirementView(db, r),
      matches: matchesForRequirement(r, visible)
        .slice(0, 5)
        .map((m): RequirementMatch => ({ ...m, listing: toListingView(db, db.listings.find((l) => l.id === m.listingId)!, me) })),
    }));
  return delay(result);
}

export async function browseListings(filters: BrowseFilters): Promise<BrowseResult[]> {
  const db = readDb();
  const me = requireRole(db, 'company');
  const myLocation = db.companies.find((c) => c.userId === me.id)?.location;
  const myRequirements = db.requirements.filter((r) => r.companyId === me.id && r.status === 'open');
  const radius = filters.radiusKm ?? MAX_RADIUS_KM;

  const results = db.listings
    .filter((l) => l.status === 'active' && !l.hidden && l.qtyRemainingKg > 0)
    .filter((l) => !filters.cropId || l.cropId === filters.cropId)
    .filter((l) => !filters.districtId || l.districtId === filters.districtId)
    .filter((l) => !filters.minQtyKg || l.qtyRemainingKg >= filters.minQtyKg)
    .filter((l) => !filters.readyBefore || l.readyDate <= filters.readyBefore)
    .filter((l) => !myLocation || haversineKm(myLocation, l.location) <= radius)
    .map((l): BrowseResult => {
      const best = matchesForListing(l, myRequirements)[0];
      return {
        listing: toListingView(db, l, me),
        bestMatch: best ? { requirementId: best.requirementId, score: best.score } : undefined,
      };
    })
    .sort(
      (a, b) =>
        (b.bestMatch?.score ?? -1) - (a.bestMatch?.score ?? -1) ||
        (a.listing.distanceKm ?? 0) - (b.listing.distanceKm ?? 0),
    );
  return delay(results.slice(0, 50), 200);
}

export async function flagListing(listingId: string, reason: string): Promise<void> {
  const clean = sanitizeText(reason);
  if (!clean) throw new ApiError(422, 'reason_required');
  mutate((db) => {
    const me = currentUser(db);
    if (!db.listings.some((l) => l.id === listingId)) throw new ApiError(404, 'not_found');
    db.flags.push({ id: newId('f'), listingId, reporterId: me.id, reason: clean, status: 'open', createdAt: nowIso() });
  });
  return delay(undefined);
}
