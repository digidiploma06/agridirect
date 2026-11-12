// Fictional seed data for the Phase 0 demo. All names, phone numbers and
// GSTINs are invented (Security & Privacy v1.0, section 12). Dates are
// relative to "today" so the demo script keeps working on any day.

import { addDays } from '../dates';
import type {
  AppNotification,
  AuditEntry,
  CompanyProfile,
  Deal,
  FarmerProfile,
  Flag,
  Listing,
  ModelMetric,
  PipelineRun,
  Requirement,
  Review,
  User,
} from '../types';

export interface MockDb {
  version: number;
  users: User[];
  farmers: FarmerProfile[];
  companies: CompanyProfile[];
  listings: Listing[];
  requirements: Requirement[];
  deals: Deal[];
  reviews: Review[];
  flags: Flag[];
  audit: AuditEntry[];
  notifications: AppNotification[];
  pipeline: PipelineRun[];
  modelMetrics: ModelMetric[];
  otpSends: Record<string, string[]>;
  session: { userId: string | null; pendingPhone: string | null };
}

export const DB_VERSION = 1;

/** ISO timestamp `days` before now, at a given IST hour. */
function at(today: string, days: number, hourIst = 10, minute = 0): string {
  const d = addDays(today, days);
  const utcHour = hourIst - 5.5;
  return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 0, 0) + utcHour * 3_600_000 + minute * 60_000).toISOString();
}

function user(id: string, role: User['role'], phone: string, name: string, language: User['language'], status: User['status'], created: string): User {
  return { id, role, phone, name, language, status, createdAt: created };
}

export function seed(today: string): MockDb {
  const t = (days: number, h?: number, m?: number) => at(today, days, h, m);
  const d = (days: number) => addDays(today, days);

  const users: User[] = [
    user('u-ramesh', 'farmer', '+919800000001', 'Ramesh Patil', 'mr', 'verified', t(-60)),
    user('u-sunita', 'farmer', '+919800000002', 'Sunita Jadhav', 'mr', 'verified', t(-45)),
    user('u-vitthal', 'farmer', '+919800000003', 'Vitthal Shinde', 'mr', 'verified', t(-40)),
    user('u-anil', 'farmer', '+919800000004', 'Anil Gaikwad', 'hi', 'verified', t(-30)),
    user('u-kavita', 'farmer', '+919800000005', 'Kavita More', 'mr', 'verified', t(-25)),
    user('u-pvf', 'company', '+919800000101', 'Sneha Kulkarni', 'en', 'verified', t(-35)),
    user('u-krishna', 'company', '+919800000102', 'Rahul Deshmukh', 'en', 'verified', t(-28)),
    user('u-bhima', 'company', '+919800000103', 'Prakash Bhosale', 'mr', 'pending', t(-3)),
    user('u-deccan', 'company', '+919800000104', 'Ayesha Shaikh', 'en', 'pending', t(-1)),
    user('u-admin', 'admin', '+919800000900', 'Operations Admin', 'en', 'verified', t(-90)),
  ];

  const farmers: FarmerProfile[] = [
    { userId: 'u-ramesh', village: 'Rahuri', districtId: 'd-ahilyanagar', location: { lat: 19.39, lng: 74.65 }, landAreaAcres: 4, irrigation: 'well', soilType: 'black' },
    { userId: 'u-sunita', village: 'Junnar', districtId: 'd-pune', location: { lat: 19.2, lng: 73.88 }, landAreaAcres: 6, irrigation: 'canal', soilType: 'black' },
    { userId: 'u-vitthal', village: 'Mohol', districtId: 'd-solapur', location: { lat: 17.81, lng: 75.64 }, landAreaAcres: 8, irrigation: 'borewell', soilType: 'black' },
    { userId: 'u-anil', village: 'Koregaon', districtId: 'd-satara', location: { lat: 17.7, lng: 74.16 }, landAreaAcres: 3, irrigation: 'drip', soilType: 'red' },
    { userId: 'u-kavita', village: 'Niphad', districtId: 'd-nashik', location: { lat: 20.08, lng: 74.11 }, landAreaAcres: 5, irrigation: 'well', soilType: 'black' },
  ];

  const companies: CompanyProfile[] = [
    { userId: 'u-pvf', companyName: 'Pune Valley Feeds Pvt Ltd', type: 'feed', gstin: '27AABCP1234Q1Z7', operatingDistricts: ['d-pune', 'd-ahilyanagar', 'd-satara'], contactPerson: 'Sneha Kulkarni', email: 'procurement@example.com', location: { lat: 18.76, lng: 73.86 }, districtId: 'd-pune', submittedAt: t(-35), verifiedAt: t(-33) },
    { userId: 'u-krishna', companyName: 'Krishna Agro Processing', type: 'processor', gstin: '27AAGCK5678R1ZH', operatingDistricts: ['d-ahilyanagar', 'd-nashik'], contactPerson: 'Rahul Deshmukh', location: { lat: 19.12, lng: 74.7 }, districtId: 'd-ahilyanagar', submittedAt: t(-28), verifiedAt: t(-27) },
    { userId: 'u-bhima', companyName: 'Bhima Oil Extracts', type: 'processor', gstin: '27AACCB9012M1ZK', operatingDistricts: ['d-solapur'], contactPerson: 'Prakash Bhosale', location: { lat: 17.68, lng: 75.92 }, districtId: 'd-solapur', submittedAt: t(-3) },
    { userId: 'u-deccan', companyName: 'Deccan Fresh Retail', type: 'retailer', gstin: '27AAJFD3456N1ZZ', operatingDistricts: ['d-pune'], contactPerson: 'Ayesha Shaikh', location: { lat: 18.56, lng: 73.91 }, districtId: 'd-pune', submittedAt: t(-1) },
  ];

  const listing = (l: Omit<Listing, 'photos' | 'status' | 'qtyRemainingKg'> & Partial<Pick<Listing, 'status' | 'qtyRemainingKg'>>): Listing => ({
    photos: [],
    status: 'active',
    qtyRemainingKg: l.qtyKg,
    ...l,
  });
  const farmerLoc = (id: string) => farmers.find((f) => f.userId === id)!;
  const at_ = (id: string) => ({ location: farmerLoc(id).location, districtId: farmerLoc(id).districtId, village: farmerLoc(id).village });

  const listings: Listing[] = [
    listing({ id: 'l-ramesh-maize', farmerId: 'u-ramesh', cropId: 'maize', variety: 'Hybrid yellow', qtyKg: 12_000, readyDate: d(21), expectedPrice: 2150, quality: { grade: 'A', moisturePct: 13 }, createdAt: t(-6), ...at_('u-ramesh') }),
    listing({ id: 'l-ramesh-onion', farmerId: 'u-ramesh', cropId: 'onion', variety: 'Red (N-53)', qtyKg: 8_000, readyDate: d(35), expectedPrice: 1700, quality: { grade: 'B' }, createdAt: t(-4), ...at_('u-ramesh') }),
    listing({ id: 'l-sunita-tomato', farmerId: 'u-sunita', cropId: 'tomato', variety: 'Hybrid round', qtyKg: 5_000, readyDate: d(10), quality: { grade: 'A' }, createdAt: t(-5), ...at_('u-sunita') }),
    listing({ id: 'l-sunita-maize', farmerId: 'u-sunita', cropId: 'maize', variety: 'Hybrid yellow', qtyKg: 6_000, qtyRemainingKg: 3_000, readyDate: d(3), expectedPrice: 2200, quality: { grade: 'A', moisturePct: 12 }, createdAt: t(-12), ...at_('u-sunita') }),
    listing({ id: 'l-vitthal-tur', farmerId: 'u-vitthal', cropId: 'tur', variety: 'BDN-711', qtyKg: 6_000, readyDate: d(40), expectedPrice: 7400, quality: { grade: 'A', moisturePct: 11 }, createdAt: t(-3), ...at_('u-vitthal') }),
    listing({ id: 'l-vitthal-maize', farmerId: 'u-vitthal', cropId: 'maize', variety: 'Local', qtyKg: 20_000, readyDate: d(14), quality: { grade: 'B', moisturePct: 15 }, createdAt: t(-8), ...at_('u-vitthal') }),
    listing({ id: 'l-anil-soybean', farmerId: 'u-anil', cropId: 'soybean', variety: 'JS-335', qtyKg: 4_000, readyDate: d(7), expectedPrice: 4700, quality: { grade: 'A', moisturePct: 10 }, createdAt: t(-7), ...at_('u-anil') }),
    listing({ id: 'l-kavita-onion', farmerId: 'u-kavita', cropId: 'onion', variety: 'Red (N-2-4-1)', qtyKg: 15_000, readyDate: d(5), expectedPrice: 1600, quality: { grade: 'A' }, createdAt: t(-2), ...at_('u-kavita') }),
  ];

  const requirements: Requirement[] = [
    { id: 'r-pvf-maize', companyId: 'u-pvf', cropId: 'maize', qtyKg: 50_000, requiredBy: d(30), deliveryLocation: { lat: 18.76, lng: 73.86 }, districtId: 'd-pune', priceMin: 2050, priceMax: 2250, qualitySpec: { minGrade: 'B', maxMoisturePct: 14 }, notes: 'Feed grade. Moisture 14% max.', status: 'open', createdAt: t(-10) },
    { id: 'r-pvf-soybean', companyId: 'u-pvf', cropId: 'soybean', qtyKg: 20_000, requiredBy: d(20), deliveryLocation: { lat: 18.76, lng: 73.86 }, districtId: 'd-pune', priceMin: 4400, priceMax: 4800, qualitySpec: { maxMoisturePct: 12 }, status: 'open', createdAt: t(-9) },
    { id: 'r-krishna-onion', companyId: 'u-krishna', cropId: 'onion', qtyKg: 25_000, requiredBy: d(40), deliveryLocation: { lat: 19.12, lng: 74.7 }, districtId: 'd-ahilyanagar', priceMin: 1500, priceMax: 1800, qualitySpec: { minGrade: 'B' }, notes: 'For dehydration unit. 45 mm+ bulbs.', status: 'open', createdAt: t(-6) },
    { id: 'r-krishna-tomato', companyId: 'u-krishna', cropId: 'tomato', qtyKg: 8_000, requiredBy: d(15), deliveryLocation: { lat: 19.12, lng: 74.7 }, districtId: 'd-ahilyanagar', priceMin: 1200, priceMax: 1500, qualitySpec: { minGrade: 'A' }, status: 'open', createdAt: t(-5) },
  ];

  const deals: Deal[] = [
    {
      id: 'deal-sunita-maize', listingId: 'l-sunita-maize', requirementId: 'r-pvf-maize', companyId: 'u-pvf', farmerId: 'u-sunita', qtyKg: 3_000, pricePerQuintal: 2200, status: 'accepted', lastOfferBy: 'company', createdAt: t(-6, 11), updatedAt: t(-4, 16),
      events: [
        { id: 'e1', actorId: 'u-pvf', actorParty: 'company', from: null, to: 'offer_sent', pricePerQuintal: 2150, qtyKg: 3_000, at: t(-6, 11) },
        { id: 'e2', actorId: 'u-sunita', actorParty: 'farmer', from: 'offer_sent', to: 'negotiation', pricePerQuintal: 2250, note: 'Moisture is 12%, grade A.', at: t(-5, 9, 30) },
        { id: 'e3', actorId: 'u-pvf', actorParty: 'company', from: 'negotiation', to: 'negotiation', pricePerQuintal: 2200, note: 'We can pick up from Junnar.', at: t(-5, 15) },
        { id: 'e4', actorId: 'u-sunita', actorParty: 'farmer', from: 'negotiation', to: 'accepted', at: t(-4, 16) },
      ],
    },
    {
      id: 'deal-ramesh-onion', listingId: 'l-ramesh-onion', requirementId: 'r-krishna-onion', companyId: 'u-krishna', farmerId: 'u-ramesh', qtyKg: 5_000, pricePerQuintal: 1650, status: 'offer_sent', lastOfferBy: 'company', createdAt: t(-1, 12), updatedAt: t(-1, 12),
      events: [{ id: 'e5', actorId: 'u-krishna', actorParty: 'company', from: null, to: 'offer_sent', pricePerQuintal: 1650, qtyKg: 5_000, note: 'Pickup from Rahuri by our truck.', at: t(-1, 12) }],
    },
    {
      id: 'deal-vitthal-maize', listingId: 'l-vitthal-maize', requirementId: 'r-pvf-maize', companyId: 'u-pvf', farmerId: 'u-vitthal', qtyKg: 10_000, status: 'enquiry', createdAt: t(-2, 10), updatedAt: t(-2, 10),
      events: [{ id: 'e6', actorId: 'u-pvf', actorParty: 'company', from: null, to: 'enquiry', qtyKg: 10_000, note: 'Can you dry to 14% moisture?', at: t(-2, 10) }],
    },
    {
      id: 'deal-anil-soybean', listingId: 'l-anil-soybean', requirementId: 'r-pvf-soybean', companyId: 'u-pvf', farmerId: 'u-anil', qtyKg: 4_000, pricePerQuintal: 4300, status: 'rejected', lastOfferBy: 'company', createdAt: t(-5, 10), updatedAt: t(-4, 18),
      events: [
        { id: 'e7', actorId: 'u-pvf', actorParty: 'company', from: null, to: 'offer_sent', pricePerQuintal: 4300, qtyKg: 4_000, at: t(-5, 10) },
        { id: 'e8', actorId: 'u-anil', actorParty: 'farmer', from: 'offer_sent', to: 'rejected', note: 'Price too low for grade A.', at: t(-4, 18) },
      ],
    },
  ];

  const pipeline: PipelineRun[] = [
    { source: 'mandi', lastRunAt: t(0, 2, 4), status: 'ok', records: 1284, message: 'data.gov.in OGD' },
    { source: 'weather', lastRunAt: t(0, 2, 11), status: 'ok', records: 186, message: 'Open-Meteo forecast + archive' },
    { source: 'soil', lastRunAt: t(-1, 2, 30), status: 'failed', records: 0, message: 'SoilGrids request timed out after 3 retries' },
  ];

  const modelMetrics: ModelMetric[] = [
    { cropId: 'maize', mapeModel: 7.8, mapeBaseline: 11.4, macroF1: 0.71, macroF1Baseline: 0.52 },
    { cropId: 'soybean', mapeModel: 6.2, mapeBaseline: 8.9, macroF1: 0.68, macroF1Baseline: 0.49 },
    { cropId: 'onion', mapeModel: 18.5, mapeBaseline: 24.1, macroF1: 0.58, macroF1Baseline: 0.44 },
    { cropId: 'tur', mapeModel: 5.9, mapeBaseline: 7.3, macroF1: 0.66, macroF1Baseline: 0.51 },
    { cropId: 'tomato', mapeModel: 22.4, mapeBaseline: 27.9, macroF1: 0.52, macroF1Baseline: 0.41 },
  ];

  const audit: AuditEntry[] = [
    { id: 'a1', actorId: 'u-admin', action: 'company.verify', entity: 'company', entityId: 'u-pvf', before: { status: 'pending' }, after: { status: 'verified' }, at: t(-33) },
    { id: 'a2', actorId: 'u-admin', action: 'company.verify', entity: 'company', entityId: 'u-krishna', before: { status: 'pending' }, after: { status: 'verified' }, at: t(-27) },
  ];

  const flags: Flag[] = [
    { id: 'f1', listingId: 'l-sunita-tomato', reporterId: 'u-krishna', reason: 'Same listing posted twice with different prices.', status: 'open', createdAt: t(-1, 17) },
  ];

  const notifications: AppNotification[] = [
    { id: 'n1', userId: 'u-ramesh', template: 'offer_received', params: { company: 'Krishna Agro Processing', crop: 'onion' }, link: '/deals/deal-ramesh-onion', read: false, createdAt: t(-1, 12) },
    { id: 'n2', userId: 'u-sunita', template: 'deal_accepted', params: { crop: 'maize' }, link: '/deals/deal-sunita-maize', read: true, createdAt: t(-4, 16) },
  ];

  return {
    version: DB_VERSION,
    users,
    farmers,
    companies,
    listings,
    requirements,
    deals,
    reviews: [],
    flags,
    audit,
    notifications,
    pipeline,
    modelMetrics,
    otpSends: {},
    session: { userId: null, pendingPhone: null },
  };
}
