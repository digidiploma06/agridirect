'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRupees, splitQty } from '@/lib/format';
import { useAppLocale } from '@/lib/hooks';

/** Locale-aware formatters with translated units (quintal / tonne). */
export function useFmt() {
  const locale = useAppLocale();
  const t = useTranslations('common.units');
  return useMemo(
    () => ({
      locale,
      date: (iso: string) => formatDate(iso, locale),
      dateTime: (iso: string) => formatDateTime(iso, locale),
      num: (n: number, digits = 1) => formatNumber(n, locale, digits),
      rupees: (n: number) => formatRupees(n, locale),
      perQuintal: (n: number) => `${formatRupees(n, locale)}/${t('q')}`,
      percent: (f: number) => formatPercent(f, locale),
      qty: (kg: number) => {
        const { value, unit } = splitQty(kg);
        return `${formatNumber(value, locale, 2)} ${t(unit)}`;
      },
      km: (km: number) => `${formatNumber(km, locale, 0)} ${t('km')}`,
    }),
    [locale, t],
  );
}
