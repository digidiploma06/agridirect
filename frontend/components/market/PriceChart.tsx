'use client';

import { useTranslations } from 'next-intl';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFmt } from '@/components/useFmt';
import type { PricePoint } from '@/lib/types';

/** Modal price (line, left axis) with arrivals (bars, right axis) per week. */
export default function PriceChart({ data }: { data: PricePoint[] }) {
  const t = useTranslations('market');
  const fmt = useFmt();
  const short = (iso: string) => fmt.date(iso).replace(/ \d{4}$/, '');

  return (
    <div className="h-72 w-full" role="img" aria-label={t('chartLabel')}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="week" tickFormatter={short} minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="price" tick={{ fontSize: 12 }} width={56} domain={['auto', 'auto']} />
          <YAxis yAxisId="arrivals" orientation="right" tick={{ fontSize: 12 }} width={44} />
          <Tooltip
            labelFormatter={(w: string) => fmt.date(w)}
            formatter={(value: number, name: string) => (name === t('modal') ? fmt.perQuintal(value) : `${fmt.num(value, 0)} t`)}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar isAnimationActive={false} yAxisId="arrivals" dataKey="arrivalsT" name={t('arrivals')} fill="#dcf0de" />
          <Line isAnimationActive={false} yAxisId="price" type="monotone" dataKey="modalPrice" name={t('modal')} stroke="#205d2e" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
