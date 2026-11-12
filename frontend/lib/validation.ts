// Field rules from PRD v1.1 section 9. Validators return an i18n error key
// (under `errors.*`) or null when the value is valid.

import type { QtyUnit } from './types';

export type ValidationError = string | null;

// Phone -----------------------------------------------------------------

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Accepts "98765 43210", "+91 9876543210", "09876543210"; returns E.164 or null. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? `+91${digits}` : null;
}

export function validatePhone(input: string): ValidationError {
  return normalizePhone(input) ? null : 'phone_invalid';
}

/** "+919876543210" -> "+91 98·····210" (Security & Privacy v1.0, section 2). */
export function maskPhone(e164: string): string {
  const local = e164.replace(/^\+91/, '');
  return `+91 ${local.slice(0, 2)}·····${local.slice(-3)}`;
}

// OTP -------------------------------------------------------------------

export function validateOtp(code: string): ValidationError {
  return /^\d{6}$/.test(code) ? null : 'otp_invalid';
}

// GSTIN -----------------------------------------------------------------

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Check character for the first 14 characters of a GSTIN (base-36 Luhn variant). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARSET.indexOf(first14.charAt(i));
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARSET.charAt((36 - (sum % 36)) % 36);
}

export function validateGstin(input: string): ValidationError {
  const gstin = input.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) return 'gstin_format';
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin.charAt(14)) return 'gstin_checksum';
  return null;
}

// Quantity --------------------------------------------------------------

export const KG_PER_UNIT: Record<QtyUnit, number> = { q: 100, t: 1000 };
export const MAX_LISTING_KG = 10_000 * 1000; // 10,000 t

export function toKg(value: number, unit: QtyUnit): number {
  return Math.round(value * KG_PER_UNIT[unit]);
}

export function validateQuantity(value: number, unit: QtyUnit): ValidationError {
  if (!Number.isFinite(value) || value <= 0) return 'qty_positive';
  if (toKg(value, unit) > MAX_LISTING_KG) return 'qty_max';
  return null;
}

// Price -----------------------------------------------------------------

export function validatePrice(value: number | undefined, required: boolean): ValidationError {
  if (value === undefined || Number.isNaN(value)) return required ? 'price_required' : null;
  if (!Number.isInteger(value) || value <= 0) return 'price_integer';
  return null;
}

export function validatePriceRange(min: number, max: number): ValidationError {
  return validatePrice(min, true) ?? validatePrice(max, true) ?? (min <= max ? null : 'price_range');
}

// Dates -----------------------------------------------------------------

export function validateNotPast(isoDate: string, today: string): ValidationError {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'date_required';
  return isoDate >= today ? null : 'date_past';
}

// Free text -------------------------------------------------------------

export const MAX_TEXT = 500;

/** Strips HTML tags and caps length (PRD: max 500 chars, HTML stripped). */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_TEXT);
}

// Photos ----------------------------------------------------------------

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function validatePhoto(file: { type: string; size: number }): ValidationError {
  if (!PHOTO_TYPES.includes(file.type)) return 'photo_type';
  if (file.size > MAX_PHOTO_BYTES) return 'photo_size';
  return null;
}
