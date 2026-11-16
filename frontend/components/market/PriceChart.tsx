'use client';

import { useTranslations } from 'next-intl';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFmt } from '@/components/useFmt';
import type { PricePoint } from '@/lib/types';

// Recharts needs literal colours, so these mirror tailwind.config.ts:
// price is the burnt-orange accent, arrivals are a cream tint behind it, and
// the grid and labels are warm greys.
const PRICE = '#d9541e';
const ARRIVALS = '#e0d8c7';
const GRID = '#e0d8c7';
const AXIS = '#6b655a';

/** Modal price (line, left axis) with arrivals (bars, right axis) per week. */
export default function PriceChart({ data }: { data: PricePoint[] }) {
  const t = useTranslations('market');
  const fmt = useFmt();
  const short = (iso: string) => fmt.date(iso).replace(/ \d{4}$/, '');

  return (
    <div className="h-72 w-full" role="img" aria-label={t('chartLabel')}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="week" tickFormatter={short} minTickGap={28} tick={{ fontSize: 12, fill: AXIS }} stroke={GRID} />
          <YAxis yAxisId="price" tick={{ fontSize: 12, fill: AXIS }} stroke={GRID} width={56} domain={['auto', 'auto']} />
          <YAxis yAxisId="arrivals" orientation="right" tick={{ fontSize: 12, fill: AXIS }} stroke={GRID} width={44} />
          <Tooltip
            labelFormatter={(w: string) => fmt.date(w)}
            formatter={(value: number, name: string) => (name === t('modal') ? fmt.perQuintal(value) : `${fmt.num(value, 0)} t`)}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar isAnimationActive={false} yAxisId="arrivals" dataKey="arrivalsT" name={t('arrivals')} fill={ARRIVALS} />
          <Line isAnimationActive={false} yAxisId="price" type="monotone" dataKey="modalPrice" name={t('modal')} stroke={PRICE} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
