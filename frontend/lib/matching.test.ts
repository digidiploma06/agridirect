import { describe, expect, it } from 'vitest';
import {
  cropMatch,
  dateFit,
  distanceScore,
  matchesForListing,
  matchesForRequirement,
  qtyFit,
  qualityFit,
  scoreMatch,
} from './matching';
import type { Listing, Requirement } from './types';

const PUNE = { lat: 18.52, lng: 73.86 };

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  farmerId: 'f1',
  cropId: 'maize',
  variety: 'Hybrid',
  qtyKg: 10_000,
  qtyRemainingKg: 10_000,
  readyDate: '2026-11-01',
  location: PUNE,
  districtId: 'd-pune',
  village: 'Test',
  quality: { grade: 'A', moisturePct: 12 },
  photos: [],
  status: 'active',
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

const requirement = (over: Partial<Requirement> = {}): Requirement => ({
  id: 'r1',
  companyId: 'c1',
  cropId: 'maize',
  qtyKg: 10_000,
  requiredBy: '2026-11-10',
  deliveryLocation: PUNE,
  districtId: 'd-pune',
  priceMin: 2000,
  priceMax: 2200,
  qualitySpec: {},
  status: 'open',
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});

describe('component scores', () => {
  it('crop match is 1 for the same crop, 0.6 for the same family, 0 otherwise', () => {
    expect(cropMatch('maize', 'maize')).toBe(1);
    expect(cropMatch('onion', 'tomato')).toBe(0.6);
    expect(cropMatch('maize', 'soybean')).toBe(0);
  });

  it('qty fit caps at 1 and scales partial supply', () => {
    expect(qtyFit(20_000, 10_000)).toBe(1);
    expect(qtyFit(2_500, 10_000)).toBe(0.25);
    expect(qtyFit(1, 0)).toBe(0);
  });

  it('distance score falls linearly to 0 at 200 km', () => {
    expect(distanceScore(0)).toBe(1);
    expect(distanceScore(100)).toBe(0.5);
    expect(distanceScore(250)).toBe(0);
  });

  it('date fit is 1 when ready in time and decays 0.1 per day late', () => {
    expect(dateFit('2026-11-01', '2026-11-10')).toBe(1);
    expect(dateFit('2026-11-10', '2026-11-10')).toBe(1);
    expect(dateFit('2026-11-13', '2026-11-10')).toBeCloseTo(0.7);
    expect(dateFit('2026-12-30', '2026-11-10')).toBe(0);
  });

  it('quality fit is the share of specs satisfied', () => {
    expect(qualityFit({ grade: 'B' }, {})).toBe(1);
    expect(qualityFit({ grade: 'A', moisturePct: 15 }, { minGrade: 'B', maxMoisturePct: 14 })).toBe(0.5);
    expect(qualityFit({}, { minGrade: 'C' })).toBe(0);
  });
});

describe('scoreMatch', () => {
  it('scores a perfect pair at 100', () => {
    expect(scoreMatch(listing(), requirement())?.score).toBe(100);
  });

  it('uses remaining quantity, not original quantity', () => {
    const m = scoreMatch(listing({ qtyRemainingKg: 5_000 }), requirement());
    expect(m?.breakdown.qty).toBe(0.5);
    expect(m?.score).toBeCloseTo(87.5);
  });

  it('returns null for different crop families or beyond 200 km', () => {
    expect(scoreMatch(listing({ cropId: 'soybean' }), requirement())).toBeNull();
    expect(scoreMatch(listing({ location: { lat: 21.15, lng: 79.09 } }), requirement())).toBeNull();
  });
});

describe('ranking', () => {
  it('ignores closed requirements and inactive listings, sorts by score', () => {
    const near = requirement({ id: 'near' });
    const far = requirement({ id: 'far', deliveryLocation: { lat: 19.09, lng: 74.74 } });
    const closed = requirement({ id: 'closed', status: 'closed' });
    expect(matchesForListing(listing(), [far, closed, near]).map((m) => m.requirementId)).toEqual(['near', 'far']);
    expect(matchesForListing(listing({ status: 'paused' }), [near])).toEqual([]);
    expect(matchesForRequirement(near, [listing({ hidden: true }), listing({ id: 'ok' })]).map((m) => m.listingId)).toEqual(['ok']);
  });
});
