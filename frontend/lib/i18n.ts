import { LOCALES, type Locale } from './types';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export interface Messages {
  [key: string]: string | Messages;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      typeof value === 'object' && typeof existing === 'object' ? deepMerge(existing, value) : value;
  }
  return out;
}

export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export const LOCALE_LABELS: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };
