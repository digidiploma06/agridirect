import { describe, expect, it } from 'vitest';
import { classify, confidenceBand, FALLBACK_MAX_CONFIDENCE, recommend, suitability } from './advice';
import { CROPS, DEMO_CROPS } from './mock/catalogue';
import { getSignal } from './mock/signals';
import type { Crop } from './types';

const crop = (id: Crop['id']) => CROPS.find((c) => c.id === id)!;
const none = { kg: 0, buyers: 0 };

describe('classify', () => {
  it('reads an arrivals glut with falling prices as low demand', () => {
    const c = classify({ forecastPriceChangePct: -15, arrivalAnomalyPct: 31, historicalMapePct: 18, fallback: false }, none);
    expect(c).toMatchObject({ demandLevel: 'low', trend: 'falling', priceDirection: 'down' });
  });

  it('reads short supply with rising prices as high demand', () => {
    const c = classify({ forecastPriceChangePct: 9, arrivalAnomalyPct: -18, historicalMapePct: 8, fallback: false }, none);
    expect(c).toMatchObject({ demandLevel: 'high', trend: 'rising', priceDirection: 'up' });
    expect(c.confidence).toBe(0.8);
  });

  it('caps confidence for cold-start fallback', () => {
    const c = classify({ forecastPriceChangePct: 0, arrivalAnomalyPct: 0, historicalMapePct: 2, fallback: true }, none);
    expect(c.confidence).toBeLessThanOrEqual(FALLBACK_MAX_CONFIDENCE);
    expect(confidenceBand(c.confidence)).toBe('low');
  });
});

describe('suitability', () => {
  const ctx = { season: 'rabi' as const, irrigation: 'well' as const, soilType: 'black' as const, zone: 'x' };

  it('is 0 out of season', () => {
    expect(suitability(crop('soybean'), ctx).score).toBe(0);
  });

  it('penalises water-hungry crops on rainfed land and explains why', () => {
    const r = suitability(crop('onion'), { ...ctx, irrigation: 'rainfed' });
    expect(r.score).toBeCloseTo(0.4);
    expect(r.notes.map((n) => n.key)).toContain('irrigation_risk');
  });
});

describe('recommend', () => {
  it('ranks maize above onion in Ahilyanagar rabi (onion glut)', () => {
    const recs = recommend({
      crops: DEMO_CROPS,
      districtId: 'd-ahilyanagar',
      ctx: { season: 'rabi', irrigation: 'well', soilType: 'black', zone: 'Scarcity zone' },
      signalFor: (c) => getSignal(c, 'd-ahilyanagar'),
      platformFor: (c) => (c === 'maize' ? { kg: 50_000, buyers: 1 } : none),
      asOf: '2026-10-25',
      modelVersion: 'test',
      horizonWeeks: 8,
    });
    expect(recs.map((r) => r.cropId)).toEqual(['maize', 'tomato', 'onion']);
    expect(recs.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(recs[0]!.explanation.map((e) => e.key)).toEqual(['arrivals_down', 'buyers_need', 'price_up']);
    expect(recs.every((r) => r.explanation.length > 0)).toBe(true);
  });

  it('labels fallback predictions', () => {
    const recs = recommend({
      crops: [crop('tomato')],
      districtId: 'd-satara',
      ctx: { season: 'rabi', irrigation: 'drip', soilType: 'red', zone: 'Sub-montane' },
      signalFor: (c) => getSignal(c, 'd-satara'),
      platformFor: () => none,
      asOf: '2026-10-25',
      modelVersion: 'test',
      horizonWeeks: 8,
    });
    expect(recs[0]?.lowConfidenceFallback).toBe(true);
    expect(recs[0]?.explanation.at(-1)?.key).toBe('fallback');
  });
});
