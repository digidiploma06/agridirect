// Rule-based matching engine, TRD v1.0 section 7.5.
//
// score = 100 x (0.30 crop + 0.25 qty + 0.20 distance + 0.15 date + 0.10 quality)
// Only pairs with crop_match > 0 and distance <= 200 km are scored.

import { CROPS } from './mock/catalogue';
import { daysBetween } from './dates';
import { haversineKm } from './geo';
import type {
  CropId,
  Grade,
  Listing,
  ListingQuality,
  Match,
  QualitySpec,
  Requirement,
  ScoreBreakdown,
} from './types';

export const MAX_RADIUS_KM = 200;
export const WEIGHTS: ScoreBreakdown = { crop: 0.3, qty: 0.25, distance: 0.2, date: 0.15, quality: 0.1 };
const SAME_FAMILY_CROP_MATCH = 0.6;
const LATE_DECAY_PER_DAY = 0.1;
const GRADE_RANK: Record<Grade, number> = { A: 3, B: 2, C: 1 };

export function cropMatch(a: CropId, b: CropId): number {
  if (a === b) return 1;
  const familyA = CROPS.find((c) => c.id === a)?.family;
  const familyB = CROPS.find((c) => c.id === b)?.family;
  return familyA !== undefined && familyA === familyB ? SAME_FAMILY_CROP_MATCH : 0;
}

export function qtyFit(listingQtyKg: number, reqQtyKg: number): number {
  if (reqQtyKg <= 0) return 0;
  return Math.min(listingQtyKg, reqQtyKg) / reqQtyKg;
}

export function distanceScore(km: number, maxRadiusKm: number = MAX_RADIUS_KM): number {
  return Math.max(0, 1 - km / maxRadiusKm);
}

/** 1 if ready on or before required-by; otherwise decays 0.1 per day late. */
export function dateFit(readyDate: string, requiredBy: string): number {
  const daysLate = daysBetween(requiredBy, readyDate);
  if (daysLate <= 0) return 1;
  return Math.max(0, 1 - LATE_DECAY_PER_DAY * daysLate);
}

/** Share of the requirement's quality specs the listing satisfies (1 when none are set). */
export function qualityFit(quality: ListingQuality, spec: QualitySpec): number {
  const checks: boolean[] = [];
  if (spec.minGrade !== undefined) {
    checks.push(quality.grade !== undefined && GRADE_RANK[quality.grade] >= GRADE_RANK[spec.minGrade]);
  }
  if (spec.maxMoisturePct !== undefined) {
    checks.push(quality.moisturePct !== undefined && quality.moisturePct <= spec.maxMoisturePct);
  }
  if (checks.length === 0) return 1;
  return checks.filter(Boolean).length / checks.length;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function scoreMatch(listing: Listing, requirement: Requirement): Match | null {
  const crop = cropMatch(listing.cropId, requirement.cropId);
  const km = haversineKm(listing.location, requirement.deliveryLocation);
  if (crop === 0 || km > MAX_RADIUS_KM) return null;

  const breakdown: ScoreBreakdown = {
    crop,
    qty: qtyFit(listing.qtyRemainingKg, requirement.qtyKg),
    distance: distanceScore(km),
    date: dateFit(listing.readyDate, requirement.requiredBy),
    quality: qualityFit(listing.quality, requirement.qualitySpec),
  };
  const weighted = (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
    (sum, key) => sum + WEIGHTS[key] * breakdown[key],
    0,
  );
  return {
    listingId: listing.id,
    requirementId: requirement.id,
    score: round2(100 * weighted),
    breakdown,
    distanceKm: round2(km),
  };
}

const isLive = (l: Listing) => l.status === 'active' && !l.hidden && l.qtyRemainingKg > 0;

function byScore(a: Match, b: Match) {
  return b.score - a.score || a.distanceKm - b.distanceKm;
}

export function matchesForListing(listing: Listing, requirements: Requirement[]): Match[] {
  if (!isLive(listing)) return [];
  return requirements
    .filter((r) => r.status === 'open')
    .map((r) => scoreMatch(listing, r))
    .filter((m): m is Match => m !== null)
    .sort(byScore);
}

export function matchesForRequirement(requirement: Requirement, listings: Listing[]): Match[] {
  if (requirement.status !== 'open') return [];
  return listings
    .filter(isLive)
    .map((l) => scoreMatch(l, requirement))
    .filter((m): m is Match => m !== null)
    .sort(byScore);
}
