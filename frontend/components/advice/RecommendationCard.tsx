'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExplanationList, useExplain } from '@/components/insight/Explanation';
import { InsightChips } from '@/components/insight/InsightChips';
import { useFmt } from '@/components/useFmt';
import type { Recommendation } from '@/lib/types';

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const t = useTranslations('advice');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const explain = useExplain();
  const [first, ...rest] = rec.explanation;

  return (
    <article className={`rounded-2xl border bg-white p-4 ${rec.rank === 1 ? 'border-gray-300 border-l-4 border-l-haldi-500' : 'border-gray-300'}`}>
      <header className="mb-3 flex items-baseline gap-3">
        <span className="w-8 shrink-0 text-2xl font-semibold tabular-nums text-haldi-700" aria-label={t('rank', { rank: rec.rank })}>
          {rec.rank}.
        </span>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{tCrop(rec.cropId)}</h3>
          <p className="text-sm text-gray-600">
            {t('suitability', { pct: fmt.percent(rec.suitability) })} · {t('horizon', { weeks: rec.horizonWeeks })}
          </p>
        </div>
      </header>

      <InsightChips demandLevel={rec.demandLevel} trend={rec.trend} priceDirection={rec.priceDirection} confidence={rec.confidence} />

      {first && <p className="mt-3 text-[17px] leading-relaxed text-gray-900">{explain(first)}</p>}

      {rec.lowConfidenceFallback && (
        <p className="mt-2 flex items-start gap-2 text-sm font-medium text-haldi-700">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {t('lowConfidence')}
        </p>
      )}

      {rest.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-touch cursor-pointer py-3 font-medium text-leaf-800">{t('why')}</summary>
          <ExplanationList items={rest} />
        </details>
      )}

      <div className="mt-2 border-t border-gray-200 pt-2">
        <Link href={`/farmer/listings?new=1&crop=${rec.cropId}`} className="inline-flex min-h-touch items-center font-semibold text-leaf-800 underline-offset-4 hover:underline">
          {t('listThis')} →
        </Link>
      </div>
    </article>
  );
}
