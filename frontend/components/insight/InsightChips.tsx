'use client';

import { useTranslations } from 'next-intl';
import { useFmt } from '@/components/useFmt';
import { confidenceBand } from '@/lib/advice';
import type { DemandLevel, PriceDirection, Trend } from '@/lib/types';

type Mood = 'good' | 'neutral' | 'bad';

const MOOD_TEXT: Record<Mood, string> = { good: 'text-leaf-700', neutral: 'text-gray-800', bad: 'text-red-700' };
const LEVEL_MOOD: Record<DemandLevel, Mood> = { high: 'good', medium: 'neutral', low: 'bad' };
const TREND_MOOD: Record<Trend, Mood> = { rising: 'good', stable: 'neutral', falling: 'bad' };
const PRICE_MOOD: Record<PriceDirection, Mood> = { up: 'good', stable: 'neutral', down: 'bad' };
const ARROW: Record<Trend | PriceDirection, string> = { rising: '↗', up: '↑', stable: '→', falling: '↘', down: '↓' };

function Cell({ label, value, mood }: { label: string; value: string; mood: Mood }) {
  return (
    <div className="px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`text-[15px] font-semibold ${MOOD_TEXT[mood]}`}>{value}</dd>
    </div>
  );
}

/** Demand, trend, price direction and confidence as a compact readout; text always carries the meaning. */
export function InsightChips({
  demandLevel,
  trend,
  priceDirection,
  confidence,
}: {
  demandLevel: DemandLevel;
  trend: Trend;
  priceDirection: PriceDirection;
  confidence: number;
}) {
  const t = useTranslations('insight');
  const fmt = useFmt();
  const band = confidenceBand(confidence);

  return (
    <dl className="grid grid-cols-2 divide-gray-200 rounded-md border border-gray-200 bg-gray-50 sm:grid-cols-4 sm:divide-x">
      <Cell label={t('demand')} value={t(`level.${demandLevel}`)} mood={LEVEL_MOOD[demandLevel]} />
      <Cell label={t('trendLabel')} value={`${ARROW[trend]} ${t(`trend.${trend}`)}`} mood={TREND_MOOD[trend]} />
      <Cell label={t('price')} value={`${ARROW[priceDirection]} ${t(`price_dir.${priceDirection}`)}`} mood={PRICE_MOOD[priceDirection]} />
      <Cell label={t('confidenceLabel')} value={`${fmt.percent(confidence)} · ${t(`band.${band}`)}`} mood={band === 'low' ? 'bad' : 'neutral'} />
    </dl>
  );
}
