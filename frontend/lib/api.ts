// Single data-access layer (TRD section 8). Every screen imports from here
// and nowhere else.
//
//   default                      -> lib/api-http.ts, the FastAPI backend
//   NEXT_PUBLIC_API_MODE=mock    -> lib/api-mock.ts, in-browser demo data
//
// Both implementations expose the same functions, so screens never change.

import * as http from './api-http';
import * as mock from './api-mock';

const impl: typeof http = process.env.NEXT_PUBLIC_API_MODE === 'mock' ? mock : http;

export { ApiError, errorCode } from './api-error';
export { CROPS, DISTRICTS, MANDIS, getCrop, getDistrict } from './mock/catalogue';
export type {
  AdviceInput,
  CompanyOnboarding,
  FarmerOnboarding,
  NewDealRequest,
  NewListingInput,
  NewRequirementInput,
  PriceSnapshotRow,
  SystemHealth,
} from './api-http';

export const PRIVACY_NOTICE_VERSION = impl.PRIVACY_NOTICE_VERSION;

// Auth & profile -- POST /auth/otp/request, /auth/otp/verify, /auth/register, /auth/refresh, /auth/logout
export const requestOtp = impl.requestOtp;
export const verifyOtp = impl.verifyOtp;
export const getSession = impl.getSession;
export const logout = impl.logout;
export const completeOnboarding = impl.completeOnboarding;
export const updateLanguage = impl.updateLanguage;
export const resetDemo = impl.resetDemo;

// AI -- POST /advice/crops, GET /predictions/demand, GET /market/prices, GET /market/snapshot
export const getAdvice = impl.getAdvice;
export const getDemand = impl.getDemand;
export const getMarketSeries = impl.getMarketSeries;
export const getPriceSnapshot = impl.getPriceSnapshot;

// Marketplace -- /listings, /requirements
export const listMyListings = impl.listMyListings;
export const getListing = impl.getListing;
export const createListing = impl.createListing;
export const setListingStatus = impl.setListingStatus;
export const flagListing = impl.flagListing;
export const browseListings = impl.browseListings;
export const createRequirement = impl.createRequirement;
export const listMyRequirements = impl.listMyRequirements;

// Deals -- /deals
export const listMyDeals = impl.listMyDeals;
export const getDeal = impl.getDeal;
export const createDeal = impl.createDeal;
export const actOnDeal = impl.actOnDeal;
export const reviewDeal = impl.reviewDeal;

// Admin & notifications -- /admin/*, /notifications
export const getAdminOverview = impl.getAdminOverview;
export const listVerifications = impl.listVerifications;
export const verifyCompany = impl.verifyCompany;
export const resolveFlag = impl.resolveFlag;
export const getSystemHealth = impl.getSystemHealth;
export const retryPipeline = impl.retryPipeline;
export const listNotifications = impl.listNotifications;
export const markNotificationsRead = impl.markNotificationsRead;
