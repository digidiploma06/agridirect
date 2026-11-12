// Offline demo implementation of the data-access layer: everything runs in
// the browser against seeded data (sessionStorage), with no backend at all.
// Selected with NEXT_PUBLIC_API_MODE=mock; see lib/api.ts.

export { ApiError, errorCode } from './api-error';
export { CROPS, DISTRICTS, MANDIS, getCrop, getDistrict } from './mock/catalogue';
export { HORIZON_WEEKS, MODEL_VERSION } from './mock/signals';

// Auth & profile -- POST /auth/otp/request, /auth/otp/verify, /auth/logout, GET/PUT /farmers|companies/me
export {
  completeOnboarding,
  getSession,
  logout,
  requestOtp,
  resetDemo,
  updateLanguage,
  verifyOtp,
  PRIVACY_NOTICE_VERSION,
  type CompanyOnboarding,
  type FarmerOnboarding,
} from './mock/server/auth';

// AI -- POST /advice/crops, GET /predictions/demand, GET /market/prices
export { getAdvice, getDemand, getMarketSeries, type AdviceInput } from './mock/server/insights';
import { getPriceSnapshot as snapshotSync, type PriceSnapshotRow } from './mock/server/insights';
export type { PriceSnapshotRow };
export async function getPriceSnapshot(): Promise<PriceSnapshotRow[]> {
  return snapshotSync();
}

// Marketplace -- /listings, /requirements, /matches
export {
  browseListings,
  createListing,
  createRequirement,
  flagListing,
  getListing,
  listMyListings,
  listMyRequirements,
  setListingStatus,
  type NewListingInput,
  type NewRequirementInput,
} from './mock/server/marketplace';

// Deals -- /deals
export { actOnDeal, createDeal, getDeal, listMyDeals, reviewDeal, type NewDealRequest } from './mock/server/deals';

// Admin & notifications -- /admin/*, /notifications
export {
  getAdminOverview,
  getSystemHealth,
  listNotifications,
  listVerifications,
  markNotificationsRead,
  resolveFlag,
  retryPipeline,
  verifyCompany,
  type SystemHealth,
} from './mock/server/admin';
