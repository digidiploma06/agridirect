'use client';

import { useTranslations } from 'next-intl';
import { useFmt } from '@/components/useFmt';
import { WEIGHTS } from '@/lib/matching';
import type { ScoreBreakdown as Breakdown } from '@/lib/types';

const KEYS = Object.keys(WEIGHTS) as (keyof Breakdown)[];

export function ScorePill({ score }: { score: number }) {
  const t = useTranslations('matches');
  const tone = score >= 75 ? 'bg-leaf-700 text-white' : score >= 50 ? 'bg-haldi-100 text-haldi-700' : 'bg-gray-200 text-gray-800';
  return (
    <span className={`inline-flex min-w-16 flex-col items-center rounded-md px-2 py-1 ${tone}`}>
      <span className="text-lg font-bold leading-tight">{Math.round(score)}</span>
      <span className="text-[11px] leading-tight">{t('score')}</span>
    </span>
  );
}

/** Per-factor bars for the TRD 7.5 matching formula. */
export function ScoreBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const t = useTranslations('matches.factors');
  const fmt = useFmt();
  return (
    <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
      {KEYS.map((k) => (
        <div key={k} className="contents">
          <dt className="text-gray-600">
            {t(k)} <span className="text-gray-400">×{WEIGHTS[k]}</span>
          </dt>
          <dd className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-haldi-500" style={{ width: `${breakdown[k] * 100}%` }} />
          </dd>
          <dd className="w-10 text-right tabular-nums text-gray-700">{fmt.percent(breakdown[k])}</dd>
        </div>
      ))}
    </dl>
  );
}
