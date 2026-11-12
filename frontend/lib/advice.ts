// Demand classification and crop recommendation (TRD section 7.3), as a
// transparent rule set. The Phase 2 ML service replaces the signal inputs
// with LightGBM forecasts and SHAP drivers; the output shape stays the same.

import type {
  Crop,
  CropId,
  DemandLevel,
  Explanation,
  Irrigation,
  PriceDirection,
  Recommendation,
  Season,
  SoilType,
  Trend,
} from './types';
import type { MarketSignal } from './mock/signals';

export interface PlatformDemand {
  kg: number;
  buyers: number;
}

export interface Classified {
  demandLevel: DemandLevel;
  trend: Trend;
  priceDirection: PriceDirection;
  demandScore: number;
  confidence: number;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const PRICE_THRESHOLD_PCT = 4;
const ARRIVAL_THRESHOLD_PCT = 10;
export const FALLBACK_MAX_CONFIDENCE = 0.4;

export function classify(signal: MarketSignal, platform: PlatformDemand): Classified {
  const { forecastPriceChangePct: price, arrivalAnomalyPct: arrivals } = signal;
  const priceDirection: PriceDirection =
    price > PRICE_THRESHOLD_PCT ? 'up' : price < -PRICE_THRESHOLD_PCT ? 'down' : 'stable';
  // Supply shortfall vs normal means demand is outrunning arrivals.
  const trend: Trend =
    arrivals <= -ARRIVAL_THRESHOLD_PCT ? 'rising' : arrivals >= ARRIVAL_THRESHOLD_PCT ? 'falling' : 'stable';
  const platformBoost = Math.min(platform.kg / 1000 / 200, 0.15);
  const demandScore = clamp(0.5 + price / 40 - arrivals / 80 + platformBoost);
  const demandLevel: DemandLevel = demandScore >= 0.62 ? 'high' : demandScore <= 0.4 ? 'low' : 'medium';
  const calibrated = clamp(1 - signal.historicalMapePct / 40, 0.2, 0.95);
  const confidence = signal.fallback ? Math.min(calibrated, FALLBACK_MAX_CONFIDENCE) : calibrated;
  return { demandLevel, trend, priceDirection, demandScore, confidence: Math.round(confidence * 100) / 100 };
}

export interface FarmContext {
  season: Season;
  irrigation: Irrigation;
  soilType: SoilType;
  zone: string;
}

const WATER_HUNGRY: CropId[] = ['onion', 'tomato'];
const LIKES_BLACK_SOIL: CropId[] = ['soybean', 'tur', 'maize'];

/** Agronomic suitability (ICAR crop-calendar style rules), 0-1. */
export function suitability(crop: Crop, ctx: FarmContext): { score: number; notes: Explanation[] } {
  if (!crop.seasons.includes(ctx.season)) return { score: 0, notes: [] };
  let score = 0.7;
  const notes: Explanation[] = [];
  if (WATER_HUNGRY.includes(crop.id)) {
    if (ctx.irrigation === 'rainfed') {
      score -= 0.3;
      notes.push({ key: 'irrigation_risk', params: {} });
    } else if (ctx.irrigation === 'drip') {
      score += 0.1;
    }
  }
  if (ctx.soilType === 'black' && LIKES_BLACK_SOIL.includes(crop.id)) {
    score += 0.1;
    notes.push({ key: 'soil_good', params: {} });
  }
  if (ctx.soilType === 'laterite') score -= 0.15;
  if (ctx.zone === 'Scarcity zone') score += crop.id === 'tur' ? 0.1 : crop.id === 'tomato' ? -0.1 : 0;
  return { score: Math.round(clamp(score) * 100) / 100, notes };
}

/** Top drivers as templated sentences (stand-in for top-3 SHAP features). */
export function explain(signal: MarketSignal, platform: PlatformDemand, extra: Explanation[] = []): Explanation[] {
  const drivers: { weight: number; e: Explanation }[] = [];
  const a = signal.arrivalAnomalyPct;
  if (Math.abs(a) >= ARRIVAL_THRESHOLD_PCT) {
    drivers.push({ weight: Math.abs(a), e: { key: a < 0 ? 'arrivals_down' : 'arrivals_up', params: { pct: Math.abs(a) } } });
  }
  const p = signal.forecastPriceChangePct;
  if (Math.abs(p) > PRICE_THRESHOLD_PCT) {
    drivers.push({ weight: Math.abs(p) * 1.5, e: { key: p > 0 ? 'price_up' : 'price_down', params: { pct: Math.abs(p) } } });
  }
  if (platform.kg > 0) {
    const tonnes = Math.round(platform.kg / 1000);
    drivers.push({ weight: 12 + tonnes / 10, e: { key: 'buyers_need', params: { buyers: platform.buyers, tonnes, km: 100 } } });
  }
  const ranked = drivers.sort((x, y) => y.weight - x.weight).map((d) => d.e);
  const out = [...ranked, ...extra].slice(0, 3);
  if (out.length === 0) out.push({ key: 'steady', params: {} });
  if (signal.fallback) out.push({ key: 'fallback', params: {} });
  return out;
}

export interface RecommendInput {
  crops: Crop[];
  districtId: string;
  ctx: FarmContext;
  signalFor: (cropId: CropId) => MarketSignal;
  platformFor: (cropId: CropId) => PlatformDemand;
  asOf: string;
  modelVersion: string;
  horizonWeeks: number;
  limit?: number;
}

/** score = 0.5 suitability + 0.35 demand/price + 0.15 platform demand; ties by confidence. */
export function recommend(input: RecommendInput): Recommendation[] {
  const scored = input.crops
    .map((crop) => {
      const suit = suitability(crop, input.ctx);
      if (suit.score === 0) return null;
      const signal = input.signalFor(crop.id);
      const platform = input.platformFor(crop.id);
      const c = classify(signal, platform);
      const platformScore = Math.min(platform.kg / 1000 / 100, 1);
      const score = 0.5 * suit.score + 0.35 * c.demandScore + 0.15 * platformScore;
      const rec: Recommendation = {
        cropId: crop.id,
        districtId: input.districtId,
        asOf: input.asOf,
        horizonWeeks: input.horizonWeeks,
        demandLevel: c.demandLevel,
        trend: c.trend,
        priceDirection: c.priceDirection,
        confidence: c.confidence,
        lowConfidenceFallback: signal.fallback,
        modelVersion: input.modelVersion,
        explanation: explain(signal, platform, suit.notes),
        rank: 0,
        suitability: suit.score,
        score: Math.round(score * 1000) / 1000,
        platformDemandKg: platform.kg,
      };
      return rec;
    })
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  return scored.slice(0, input.limit ?? 5).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function confidenceBand(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < 0.5) return 'low';
  if (confidence < 0.75) return 'medium';
  return 'high';
}
