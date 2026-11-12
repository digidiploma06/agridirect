// Demo-mode auth. No SMS is sent and any 6-digit code is accepted
// (Security & Privacy v1.0, section 12). The send limit is enforced so the
// rule can be shown in usability tests.

import { ApiError } from '../../api-error';
import { normalizePhone, sanitizeText, validateGstin, validateOtp } from '../../validation';
import type { CompanyType, Irrigation, LatLng, Locale, SoilType, User } from '../../types';
import type { Session } from '../../views';
import { mutate, newId, readDb, resetDb } from '../store';
import { audit, currentUser, delay, nowIso } from './context';

const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SENDS = 3;
export const PRIVACY_NOTICE_VERSION = 'demo-2026-10';

export async function requestOtp(rawPhone: string): Promise<{ phone: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new ApiError(422, 'phone_invalid');
  mutate((db) => {
    const now = Date.now();
    const recent = (db.otpSends[phone] ?? []).filter((t) => now - Date.parse(t) < OTP_WINDOW_MS);
    if (recent.length >= OTP_MAX_SENDS) throw new ApiError(429, 'otp_rate_limited');
    db.otpSends[phone] = [...recent, new Date(now).toISOString()];
    db.session.pendingPhone = phone;
  });
  return delay({ phone });
}

/** Returns the user, or null when the number is new and must onboard. */
export async function verifyOtp(phone: string, code: string): Promise<User | null> {
  if (validateOtp(code)) throw new ApiError(422, 'otp_invalid');
  const user = mutate((db) => {
    if (db.session.pendingPhone !== phone) throw new ApiError(410, 'otp_expired');
    const existing = db.users.find((u) => u.phone === phone) ?? null;
    if (existing?.status === 'blocked') throw new ApiError(403, 'blocked');
    db.session.userId = existing?.id ?? null;
    if (existing) db.session.pendingPhone = null;
    return existing;
  });
  return delay(user);
}

export async function getSession(): Promise<Session | null> {
  const db = readDb();
  const user = db.users.find((u) => u.id === db.session.userId);
  if (!user) return delay(null, 0);
  return delay(
    {
      user,
      farmer: db.farmers.find((f) => f.userId === user.id),
      company: db.companies.find((c) => c.userId === user.id),
    },
    0,
  );
}

export async function logout(): Promise<void> {
  mutate((db) => {
    db.session = { userId: null, pendingPhone: null };
  });
}

interface OnboardingBase {
  name: string;
  language: Locale;
  location: LatLng;
  districtId: string;
  consentAccount: boolean;
  consentMarketing: boolean;
  ageConfirmed: boolean;
}

export interface FarmerOnboarding extends OnboardingBase {
  role: 'farmer';
  village: string;
  landAreaAcres: number;
  irrigation: Irrigation;
  soilType: SoilType;
}

export interface CompanyOnboarding extends OnboardingBase {
  role: 'company';
  companyName: string;
  type: CompanyType;
  gstin: string;
  operatingDistricts: string[];
  email?: string;
}

export async function completeOnboarding(input: FarmerOnboarding | CompanyOnboarding): Promise<User> {
  if (!input.consentAccount || !input.ageConfirmed) throw new ApiError(422, 'consent_required');
  const name = sanitizeText(input.name);
  if (!name) throw new ApiError(422, 'name_required');

  const user = mutate((db) => {
    const phone = db.session.pendingPhone;
    if (!phone) throw new ApiError(401, 'unauthenticated');
    if (db.users.some((u) => u.phone === phone)) throw new ApiError(409, 'phone_taken');
    const now = nowIso();
    const created: User = {
      id: newId('u'),
      role: input.role,
      phone,
      name,
      language: input.language,
      status: input.role === 'company' ? 'pending' : 'verified',
      createdAt: now,
    };
    if (input.role === 'farmer') {
      if (!(input.landAreaAcres > 0)) throw new ApiError(422, 'land_area_invalid');
      db.farmers.push({
        userId: created.id,
        village: sanitizeText(input.village),
        districtId: input.districtId,
        location: input.location,
        landAreaAcres: input.landAreaAcres,
        irrigation: input.irrigation,
        soilType: input.soilType,
      });
    } else {
      const gstin = input.gstin.trim().toUpperCase();
      const gstErr = validateGstin(gstin);
      if (gstErr) throw new ApiError(422, gstErr);
      if (db.companies.some((c) => c.gstin === gstin)) throw new ApiError(409, 'gstin_taken');
      db.companies.push({
        userId: created.id,
        companyName: sanitizeText(input.companyName),
        type: input.type,
        gstin,
        operatingDistricts: input.operatingDistricts,
        contactPerson: name,
        email: input.email?.trim() || undefined,
        location: input.location,
        districtId: input.districtId,
        submittedAt: now,
      });
    }
    db.users.push(created);
    db.session = { userId: created.id, pendingPhone: null };
    audit(db, {
      actorId: created.id,
      action: 'consent.given',
      entity: 'user',
      entityId: created.id,
      after: { notice: PRIVACY_NOTICE_VERSION, account: true, marketing: input.consentMarketing },
    });
    return created;
  });
  return delay(user);
}

export async function updateLanguage(language: Locale): Promise<void> {
  mutate((db) => {
    const me = currentUser(db);
    const u = db.users.find((x) => x.id === me.id);
    if (u) u.language = language;
  });
}

export async function resetDemo(): Promise<void> {
  resetDb();
}
