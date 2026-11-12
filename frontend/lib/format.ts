import type { Locale } from './types';

const INTL_LOCALE: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

/** DD MMM YYYY, Indian format (PRD section 9). */
export function formatDate(isoDate: string, locale: Locale = 'en'): string {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00+05:30` : isoDate);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

export function formatDateTime(iso: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

/** Indian digit grouping, e.g. 1,25,000. */
export function formatNumber(n: number, locale: Locale = 'en', maxFractionDigits = 1): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatRupees(n: number, locale: Locale = 'en'): string {
  return `₹${formatNumber(n, locale, 0)}`;
}

/**
 * Kilograms to the unit farmers read: tonnes from 1 t upward, else quintals.
 * Returns the number and unit separately so the unit can be translated.
 */
export function splitQty(kg: number): { value: number; unit: 'q' | 't' } {
  return kg >= 1000 ? { value: kg / 1000, unit: 't' } : { value: kg / 100, unit: 'q' };
}

export function formatQty(kg: number, locale: Locale = 'en'): string {
  const { value, unit } = splitQty(kg);
  return `${formatNumber(value, locale, 2)} ${unit}`;
}

export function formatPercent(fraction: number, locale: Locale = 'en'): string {
  return `${formatNumber(Math.round(fraction * 100), locale, 0)}%`;
}
