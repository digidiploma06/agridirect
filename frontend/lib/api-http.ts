// Real implementation of the data-access layer: typed fetch calls to the
// FastAPI backend at /api/v1 (TRD section 6).
//
// In the browser, requests go to the same origin and Next.js proxies them to
// the backend (see next.config.mjs), so there is no CORS and the refresh
// cookie is first-party. The short-lived access token lives in memory only;
// after a page reload it is re-issued from the httpOnly refresh cookie.

import { ApiError } from './api-error';
import type { ActionInput } from './deals';
import type { AdviceInput, PriceSnapshotRow } from './mock/server/insights';
import type { CompanyOnboarding, FarmerOnboarding } from './mock/server/auth';
import type { NewDealRequest } from './mock/server/deals';
import type { NewListingInput, NewRequirementInput } from './mock/server/marketplace';
import type { SystemHealth } from './mock/server/admin';
import type {
  AdviceResponse,
  AppNotification,
  CropId,
  Deal,
  Listing,
  Locale,
  PipelineSource,
  Prediction,
  PricePoint,
  Requirement,
  User,
} from './types';
import type {
  AdminOverview,
  BrowseFilters,
  BrowseResult,
  DealView,
  ListingDetail,
  ListingView,
  RequirementWithMatches,
  Session,
  VerificationItem,
} from './views';

export type { AdviceInput, CompanyOnboarding, FarmerOnboarding, NewDealRequest, NewListingInput, NewRequirementInput, PriceSnapshotRow, SystemHealth };

export const PRIVACY_NOTICE_VERSION = 'demo-2026-10';

const isServer = typeof window === 'undefined';
const BASE = `${isServer ? (process.env.API_URL ?? 'http://127.0.0.1:8000') : ''}/api/v1`;
const REG_TOKEN_KEY = 'agridirect-registration-token';

let accessToken: string | null = null;
let refreshInFlight: Promise<Session | null> | null = null;

interface AuthResponse {
  accessToken: string;
  session: Session;
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'unknown';
  try {
    const body = (await res.json()) as { code?: unknown };
    if (typeof body.code === 'string') code = body.code;
  } catch {
    // Not JSON (e.g. the backend is not running and the proxy returned HTML).
  }
  return new ApiError(res.status, code);
}

async function send(method: string, path: string, body?: unknown, raw?: BodyInit): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'unknown'); // network failure
  }
}

/** Exchanges the refresh cookie for a new access token. Null when signed out. */
function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await send('POST', '/auth/refresh');
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data.session;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  if (auth && !accessToken) await refreshSession();
  let res = await send(method, path, body);
  if (res.status === 401 && auth && (await refreshSession())) res = await send(method, path, body);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

// Auth & profile -----------------------------------------------------------

/** `devOtp` is only present when the backend runs with OTP_MODE=demo. */
export function requestOtp(rawPhone: string): Promise<{ phone: string; devOtp?: string }> {
  return request('POST', '/auth/otp/request', { phone: rawPhone }, false);
}

/** Returns the user, or null when the number is new and must onboard. */
export async function verifyOtp(phone: string, code: string): Promise<User | null> {
  const data = await request<{ user: User | null; accessToken?: string; registrationToken?: string }>(
    'POST',
    '/auth/otp/verify',
    { phone, code },
    false,
  );
  if (data.user && data.accessToken) {
    accessToken = data.accessToken;
    window.sessionStorage.removeItem(REG_TOKEN_KEY);
    return data.user;
  }
  if (data.registrationToken) window.sessionStorage.setItem(REG_TOKEN_KEY, data.registrationToken);
  return null;
}

export async function getSession(): Promise<Session | null> {
  if (isServer) return null;
  if (!accessToken) return refreshSession();
  try {
    return await get<Session>('/auth/session');
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await send('POST', '/auth/logout');
  } finally {
    accessToken = null;
    window.sessionStorage.removeItem(REG_TOKEN_KEY);
  }
}

export async function completeOnboarding(input: FarmerOnboarding | CompanyOnboarding): Promise<User> {
  const registrationToken = window.sessionStorage.getItem(REG_TOKEN_KEY);
  if (!registrationToken) throw new ApiError(401, 'unauthenticated');
  const data = await request<AuthResponse & { user: User }>('POST', '/auth/register', { ...input, registrationToken }, false);
  accessToken = data.accessToken;
  window.sessionStorage.removeItem(REG_TOKEN_KEY);
  return data.user;
}

export function updateLanguage(language: Locale): Promise<void> {
  return request('PUT', '/users/me/language', { language });
}

/** Only meaningful in mock mode; the real backend is reset from its own folder. */
export async function resetDemo(): Promise<void> {}

// AI ------------------------------------------------------------------------

export const getAdvice = (input: AdviceInput) => post<AdviceResponse>('/advice/crops', input);

export const getDemand = (cropId: CropId, districtId: string) =>
  get<Prediction>(`/predictions/demand${query({ crop: cropId, district: districtId })}`);

export const getMarketSeries = (cropId: CropId, mandiId: string) =>
  get<PricePoint[]>(`/market/prices${query({ crop: cropId, mandi: mandiId })}`);

/** Public; used by the server-rendered home page. Empty when the backend is unreachable. */
export async function getPriceSnapshot(): Promise<PriceSnapshotRow[]> {
  try {
    return await request<PriceSnapshotRow[]>('GET', '/market/snapshot', undefined, false);
  } catch {
    return [];
  }
}

// Marketplace ---------------------------------------------------------------

export const listMyListings = () => get<ListingView[]>('/listings/mine');
export const getListing = (id: string) => get<ListingDetail>(`/listings/${encodeURIComponent(id)}`);
export const createListing = (input: NewListingInput) => post<Listing>('/listings', input);
export const setListingStatus = (id: string, status: 'active' | 'paused') =>
  patch<void>(`/listings/${encodeURIComponent(id)}`, { status });
export const flagListing = (listingId: string, reason: string) =>
  post<void>(`/listings/${encodeURIComponent(listingId)}/flag`, { reason });
export const browseListings = (filters: BrowseFilters) => get<BrowseResult[]>(`/listings${query({ ...filters })}`);
export const createRequirement = (input: NewRequirementInput) => post<Requirement>('/requirements', input);
export const listMyRequirements = () => get<RequirementWithMatches[]>('/requirements/mine');

// Deals ---------------------------------------------------------------------

export const listMyDeals = () => get<DealView[]>('/deals');
export const getDeal = (id: string) => get<DealView>(`/deals/${encodeURIComponent(id)}`);
export const createDeal = (input: NewDealRequest) => post<Deal>('/deals', input);
export const actOnDeal = (id: string, input: ActionInput) =>
  patch<DealView>(`/deals/${encodeURIComponent(id)}/status`, input);
export const reviewDeal = (id: string, rating: number, comment?: string) =>
  post<void>(`/deals/${encodeURIComponent(id)}/review`, { rating, comment });

// Admin & notifications -------------------------------------------------------

export const getAdminOverview = () => get<AdminOverview>('/admin/overview');
export const listVerifications = () => get<VerificationItem[]>('/admin/verifications');
export const verifyCompany = (userId: string, decision: 'approve' | 'reject', reason?: string) =>
  patch<void>(`/admin/users/${encodeURIComponent(userId)}/verify`, { decision, reason });
export const resolveFlag = (flagId: string, action: 'dismiss' | 'hide' | 'block') =>
  post<void>(`/admin/flags/${encodeURIComponent(flagId)}/resolve`, { action });
export const getSystemHealth = () => get<SystemHealth>('/admin/system');
export const retryPipeline = (source: PipelineSource) => post<void>(`/admin/pipeline/${source}/run`);
export const listNotifications = () => get<AppNotification[]>('/notifications');
export const markNotificationsRead = () => post<void>('/notifications/read');
