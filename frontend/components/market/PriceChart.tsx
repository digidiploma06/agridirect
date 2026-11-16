'use client';

import { useTranslations } from 'next-intl';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFmt } from '@/components/useFmt';
import type { PricePoint } from '@/lib/types';

// Recharts needs literal colours, so these mirror tailwind.config.ts:
// price is the burnt-orange accent, arrivals are a cream tint behind it, and
// the grid and labels are warm greys.
const PRICE = '#d9541e';
const ARRIVALS = '#e0d8c7';
const GRID = '#e0d8c7';
const AXIS = '#6b655a';
const BAND = '#f9dccb';

/** Modal price (line, left axis) with arrivals (bars, right axis) per week. */
export default function PriceChart({ data }: { data: PricePoint[] }) {
  const t = useTranslations('market');
  const fmt = useFmt();
  // Recharts has no range series, so the min-max band is two stacked areas:
  // an invisible floor at the low, then the spread drawn on top of it.
  const rows = data.map((d) => ({ ...d, floor: d.minPrice, spread: Math.max(0, d.maxPrice - d.minPrice) }));
  const short = (iso: string) => fmt.date(iso).replace(/ \d{4}$/, '');

  return (
    <div className="h-72 w-full" role="img" aria-label={t('chartLabel')}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="week" tickFormatter={short} minTickGap={28} tick={{ fontSize: 12, fill: AXIS }} stroke={GRID} />
          <YAxis yAxisId="price" tick={{ fontSize: 12, fill: AXIS }} stroke={GRID} width={56} domain={['auto', 'auto']} />
          <YAxis yAxisId="arrivals" orientation="right" tick={{ fontSize: 12, fill: AXIS }} stroke={GRID} width={44} />
          <Tooltip
            labelFormatter={(w: string) => fmt.date(w)}
            formatter={(value: number, name: string, item: { payload?: PricePoint }) => {
              if (name === t('range')) return item.payload ? `${fmt.perQuintal(item.payload.minPrice)} – ${fmt.perQuintal(item.payload.maxPrice)}` : '';
              return name === t('modal') ? fmt.perQuintal(value) : `${fmt.num(value, 0)} t`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Area isAnimationActive={false} yAxisId="price" dataKey="floor" stackId="band" stroke="none" fill="none" legendType="none" tooltipType="none" />
          <Area isAnimationActive={false} yAxisId="price" dataKey="spread" stackId="band" stroke="none" fill={BAND} legendType="rect" name={t('range')} />
          <Bar isAnimationActive={false} yAxisId="arrivals" dataKey="arrivalsT" name={t('arrivals')} fill={ARRIVALS} />
          <Line isAnimationActive={false} yAxisId="price" type="monotone" dataKey="modalPrice" name={t('modal')} stroke={PRICE} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
