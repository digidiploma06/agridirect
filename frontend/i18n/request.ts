import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, deepMerge, isLocale, type Messages } from '@/lib/i18n';

// Locale comes from a cookie rather than the URL so the language can be
// switched on any screen without changing routes (PRD FR-14).
export default getRequestConfig(async () => {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : 'en';
  const en = (await import('../messages/en.json')).default as Messages;
  // Untranslated keys fall back to English instead of showing raw keys.
  const messages =
    locale === 'en' ? en : deepMerge(en, (await import(`../messages/${locale}.json`)).default as Messages);
  return { locale, messages, timeZone: 'Asia/Kolkata' };
});
