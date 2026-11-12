// Stand-ins for POST /advice/crops, GET /predictions/demand and
// GET /market/prices. In Phase 2 these proxy the ML service.

import { classify, explain, recommend, type PlatformDemand } from '../../advice';
import { ApiError } from '../../api-error';
import { todayIso } from '../../dates';
import { haversineKm } from '../../geo';
import type { AdviceResponse, CropId, Irrigation, LatLng, Prediction, PricePoint, Season, SoilType } from '../../types';
import { DEMO_CROPS, getDistrict } from '../catalogue';
import { marketSeries } from '../market';
import type { MockDb } from '../seed';
import { getSignal, HORIZON_WEEKS, MODEL_VERSION } from '../signals';
import { readDb } from '../store';
import { currentUser, delay, liveRequirements, requireRole } from './context';

export const DEMAND_RADIUS_KM = 100;

/** Open verified-company requirement tonnage near a point (TRD feature "platform demand"). */
export function platformDemand(db: MockDb, cropId: CropId, at: LatLng, radiusKm = DEMAND_RADIUS_KM): PlatformDemand {
  const near = liveRequirements(db).filter(
    (r) => r.cropId === cropId && haversineKm(r.deliveryLocation, at) <= radiusKm,
  );
  return { kg: near.reduce((s, r) => s + r.qtyKg, 0), buyers: new Set(near.map((r) => r.companyId)).size };
}

export interface AdviceInput {
  districtId: string;
  landAreaAcres: number;
  season: Season;
  irrigation: Irrigation;
  soilType: SoilType;
}

export async function getAdvice(input: AdviceInput): Promise<AdviceResponse> {
  const db = readDb();
  requireRole(db, 'farmer');
  const district = getDistrict(input.districtId);
  if (!district) throw new ApiError(422, 'district_required');
  if (!(input.landAreaAcres > 0)) throw new ApiError(422, 'land_area_invalid');
  const asOf = todayIso();
  const recommendations = recommend({
    crops: DEMO_CROPS,
    districtId: district.id,
    ctx: { season: input.season, irrigation: input.irrigation, soilType: input.soilType, zone: district.zone },
    signalFor: (c) => getSignal(c, district.id),
    platformFor: (c) => platformDemand(db, c, district.centroid),
    asOf,
    modelVersion: MODEL_VERSION,
    horizonWeeks: HORIZON_WEEKS,
  });
  return delay({ asOf, modelVersion: MODEL_VERSION, recommendations }, 350);
}

export function predictionFor(db: MockDb, cropId: CropId, districtId: string, at?: LatLng): Prediction {
  const district = getDistrict(districtId);
  const point = at ?? district?.centroid ?? { lat: 18.52, lng: 73.86 };
  const signal = getSignal(cropId, districtId);
  const platform = platformDemand(db, cropId, point);
  const c = classify(signal, platform);
  return {
    cropId,
    districtId,
    asOf: todayIso(),
    horizonWeeks: HORIZON_WEEKS,
    demandLevel: c.demandLevel,
    trend: c.trend,
    priceDirection: c.priceDirection,
    confidence: c.confidence,
    lowConfidenceFallback: signal.fallback,
    modelVersion: MODEL_VERSION,
    explanation: explain(signal, platform),
  };
}

export async function getDemand(cropId: CropId, districtId: string): Promise<Prediction> {
  const db = readDb();
  currentUser(db);
  return delay(predictionFor(db, cropId, districtId));
}

export async function getMarketSeries(cropId: CropId, mandiId: string): Promise<PricePoint[]> {
  currentUser(readDb());
  return delay(marketSeries(cropId, mandiId, todayIso()), 200);
}

export interface PriceSnapshotRow {
  cropId: CropId;
  mandiName: string;
  modalPrice: number;
  change4w: number;
}

/** Latest modal price per crop at its main pilot mandi (public, for the home page). */
export function getPriceSnapshot(): PriceSnapshotRow[] {
  const today = todayIso();
  const rows: [CropId, string, string][] = [
    ['onion', 'm-lasalgaon', 'Lasalgaon'],
    ['maize', 'm-ahilyanagar', 'Ahilyanagar'],
    ['soybean', 'm-pune', 'Pune'],
    ['tur', 'm-solapur', 'Solapur'],
    ['tomato', 'm-pune', 'Pune'],
  ];
  return rows.map(([cropId, mandiId, mandiName]) => {
    const series = marketSeries(cropId, mandiId, today);
    const last = series.at(-1)!.modalPrice;
    const prev = series.at(-5)!.modalPrice;
    return { cropId, mandiName, modalPrice: last, change4w: (last - prev) / prev };
  });
}
