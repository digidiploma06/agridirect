// Domain types shared by the prototype and (later) the API client.
// Field names follow TRD v1.0 section 5. Quantities are kilograms (integer);
// prices are rupees per quintal (integer) on the wire, as in TRD section 6.

export type Role = 'farmer' | 'company' | 'admin';
export type Party = 'farmer' | 'company';
export type Locale = 'en' | 'hi' | 'mr';
export const LOCALES: readonly Locale[] = ['en', 'hi', 'mr'];

export type UserStatus = 'pending' | 'verified' | 'rejected' | 'blocked';
/** Crop ids come from the catalogue (tools/build_catalogue.py), e.g. 'maize', 'cotton'. */
export type CropId = string;
export type CropFamily = 'cereal' | 'oilseed' | 'vegetable' | 'pulse' | 'fibre' | 'cash' | 'spice';
export type Season = 'kharif' | 'rabi' | 'zaid';
export type Irrigation = 'rainfed' | 'well' | 'borewell' | 'canal' | 'drip';
export type SoilType = 'black' | 'red' | 'alluvial' | 'laterite' | 'unknown';
export type Grade = 'A' | 'B' | 'C';
export type QtyUnit = 'q' | 't';
export type CompanyType = 'processor' | 'feed' | 'exporter' | 'retailer' | 'fpo' | 'trader' | 'institution';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Crop {
  id: CropId;
  family: CropFamily;
  seasons: Season[];
  durationDays: number;
  agmarknetCode: string;
}

export interface District {
  id: string;
  name: string;
  state: string;
  centroid: LatLng;
  zone: string;
}

export interface Mandi {
  id: string;
  name: string;
  districtId: string;
  location: LatLng;
  /** Crops commonly traded at this mandi. */
  crops: CropId[];
}

export interface User {
  id: string;
  role: Role;
  phone: string; // E.164
  name: string;
  language: Locale;
  status: UserStatus;
  createdAt: string;
}

export interface FarmerProfile {
  userId: string;
  village: string;
  districtId: string;
  location: LatLng;
  landAreaAcres: number;
  irrigation: Irrigation;
  soilType: SoilType;
}

export interface CompanyProfile {
  userId: string;
  companyName: string;
  type: CompanyType;
  gstin: string;
  operatingDistricts: string[];
  contactPerson: string;
  email?: string;
  location: LatLng;
  districtId: string;
  submittedAt: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface ListingQuality {
  grade?: Grade;
  moisturePct?: number;
}

export interface QualitySpec {
  minGrade?: Grade;
  maxMoisturePct?: number;
}

export type ListingStatus = 'active' | 'paused' | 'sold' | 'expired';

export interface Listing {
  id: string;
  farmerId: string;
  cropId: CropId;
  variety: string;
  qtyKg: number;
  qtyRemainingKg: number;
  readyDate: string; // YYYY-MM-DD
  expectedPrice?: number;
  location: LatLng;
  districtId: string;
  village: string;
  quality: ListingQuality;
  photos: string[];
  status: ListingStatus;
  hidden?: boolean;
  createdAt: string;
}

export type RequirementStatus = 'open' | 'closed';

export interface Requirement {
  id: string;
  companyId: string;
  cropId: CropId;
  qtyKg: number;
  requiredBy: string; // YYYY-MM-DD
  deliveryLocation: LatLng;
  districtId: string;
  priceMin: number;
  priceMax: number;
  qualitySpec: QualitySpec;
  notes?: string;
  status: RequirementStatus;
  createdAt: string;
}

export interface ScoreBreakdown {
  crop: number;
  qty: number;
  distance: number;
  date: number;
  quality: number;
}

export interface Match {
  listingId: string;
  requirementId: string;
  score: number; // 0-100, 2 decimals
  breakdown: ScoreBreakdown;
  distanceKm: number;
}

export type DealStatus =
  | 'enquiry'
  | 'offer_sent'
  | 'negotiation'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export type DealAction = 'send_offer' | 'counter' | 'accept' | 'reject' | 'cancel' | 'complete';

export interface DealEvent {
  id: string;
  actorId: string;
  actorParty: Party;
  from: DealStatus | null;
  to: DealStatus;
  pricePerQuintal?: number;
  qtyKg?: number;
  note?: string;
  at: string;
}

export interface Deal {
  id: string;
  listingId: string;
  requirementId?: string;
  companyId: string;
  farmerId: string;
  qtyKg: number;
  pricePerQuintal?: number;
  status: DealStatus;
  lastOfferBy?: Party;
  events: DealEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  dealId: string;
  reviewerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export type DemandLevel = 'low' | 'medium' | 'high';
export type Trend = 'falling' | 'stable' | 'rising';
export type PriceDirection = 'down' | 'stable' | 'up';

/** A templated explanation; the UI renders `advice.explain.<key>` with params. */
export interface Explanation {
  key: string;
  params: Record<string, string | number>;
}

export interface Prediction {
  cropId: CropId;
  districtId: string;
  asOf: string;
  horizonWeeks: number;
  demandLevel: DemandLevel;
  trend: Trend;
  priceDirection: PriceDirection;
  confidence: number; // 0-1
  lowConfidenceFallback: boolean;
  modelVersion: string;
  explanation: Explanation[];
}

export interface Recommendation extends Prediction {
  rank: number;
  suitability: number;
  score: number;
  platformDemandKg: number;
}

export interface AdviceResponse {
  asOf: string;
  modelVersion: string;
  recommendations: Recommendation[];
}

export interface PricePoint {
  week: string; // YYYY-MM-DD (week start)
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  arrivalsT: number;
}

export type PipelineSource = 'mandi' | 'weather' | 'soil';
export type PipelineState = 'ok' | 'failed' | 'running';

export interface PipelineRun {
  source: PipelineSource;
  lastRunAt: string;
  status: PipelineState;
  records: number;
  message?: string;
}

export interface ModelMetric {
  cropId: CropId;
  mapeModel: number;
  mapeBaseline: number;
  macroF1: number;
  macroF1Baseline: number;
}

export type FlagStatus = 'open' | 'dismissed' | 'hidden' | 'blocked';

export interface Flag {
  id: string;
  listingId: string;
  reporterId: string;
  reason: string;
  status: FlagStatus;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  at: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  template: string; // i18n key under notifications.*
  params: Record<string, string | number>;
  link?: string;
  read: boolean;
  createdAt: string;
}
