'use client';

import { BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFmt } from '@/components/useFmt';
import { roundTo5Km } from '@/lib/geo';
import type { ListingMatch } from '@/lib/views';
import { ScoreBreakdown, ScorePill } from './ScoreBreakdown';

/** A company requirement suggested for one of the farmer's listings. */
export function RequirementMatchRow({ match }: { match: ListingMatch }) {
  const t = useTranslations('matches');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const r = match.requirement;
  return (
    <li className="rounded-md border border-gray-200 p-3">
      <div className="flex items-start gap-3">
        <ScorePill score={match.score} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold">
            {r.companyName}
            {r.companyVerified && <BadgeCheck aria-label={t('verified')} className="h-5 w-5 text-leaf-700" />}
          </p>
          <p className="text-gray-700">
            {t('needs', { qty: fmt.qty(r.qtyKg), crop: tCrop(r.cropId), date: fmt.date(r.requiredBy) })}
          </p>
          <p className="text-sm text-gray-600">
            {fmt.perQuintal(r.priceMin)}–{fmt.perQuintal(r.priceMax)} · ~{fmt.km(roundTo5Km(match.distanceKm))}
          </p>
        </div>
      </div>
      <details className="mt-2">
        <summary className="min-h-touch cursor-pointer py-2 text-sm font-medium text-leaf-800">{t('howScored')}</summary>
        <ScoreBreakdown breakdown={match.breakdown} />
      </details>
    </li>
  );
}
