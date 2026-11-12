'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CropOptions } from '@/components/forms/options';
import { ExplanationList } from '@/components/insight/Explanation';
import { InsightChips } from '@/components/insight/InsightChips';
import { Disclaimer } from '@/components/insight/Disclaimer';
import { Card, PageHeader } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Field';
import { Stat } from '@/components/ui/Stat';
import { ErrorNote, Loading } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { CropId, PricePoint } from '@/lib/types';

// Recharts is the heaviest dependency; load it only on this route.
const PriceChart = dynamic(() => import('@/components/market/PriceChart'), { ssr: false, loading: () => <Loading /> });

function change(series: PricePoint[], weeks: number): number | null {
  const last = series.at(-1)?.modalPrice;
  const prev = series.at(-1 - weeks)?.modalPrice;
  return last && prev ? (last - prev) / prev : null;
}

export default function MarketPage() {
  const t = useTranslations('market');
  const fmt = useFmt();
  const { session } = useSession();
  const homeDistrict = session?.farmer?.districtId ?? session?.company?.districtId;
  const defaultMandi = api.MANDIS.find((m) => m.districtId === homeDistrict)?.id ?? api.MANDIS[0]!.id;
  const [cropId, setCropId] = useState<CropId>('maize');
  const [mandiId, setMandiId] = useState(defaultMandi);
  // Only mandis where this crop is commonly traded; keep the choice valid when the crop changes.
  const mandis = api.MANDIS.filter((m) => m.crops.includes(cropId));
  const mandi = mandis.find((m) => m.id === mandiId) ?? mandis[0] ?? api.MANDIS[0]!;
  const series = useApi(() => api.getMarketSeries(cropId, mandi.id), [cropId, mandi.id]);
  const demand = useApi(() => api.getDemand(cropId, mandi.districtId), [cropId, mandi.districtId]);

  const latest = series.data?.at(-1);
  const delta4 = series.data ? change(series.data, 4) : null;

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('crop')} value={cropId} onChange={(e) => setCropId(e.target.value as CropId)}>
          <CropOptions />
        </SelectField>
        <SelectField label={t('mandi')} value={mandi.id} onChange={(e) => setMandiId(e.target.value)}>
          {mandis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
      </div>

      <ErrorNote code={series.error} onRetry={series.reload} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t('latestModal')} value={latest ? fmt.perQuintal(latest.modalPrice) : '—'} hint={latest && t('weekOf', { date: fmt.date(latest.week) })} />
        <Stat label={t('change4w')} value={delta4 === null ? '—' : `${delta4 > 0 ? '+' : ''}${fmt.percent(delta4)}`} />
        <Stat label={t('arrivalsLatest')} value={latest ? `${fmt.num(latest.arrivalsT, 0)} t` : '—'} />
      </div>

      <Card title={t('chartTitle')}>{series.data ? <PriceChart data={series.data} /> : <Loading />}</Card>

      <Card title={t('outlookTitle')}>
        {demand.loading && !demand.data && <Loading />}
        <ErrorNote code={demand.error} onRetry={demand.reload} />
        {demand.data && (
          <div className="space-y-3">
            <InsightChips
              demandLevel={demand.data.demandLevel}
              trend={demand.data.trend}
              priceDirection={demand.data.priceDirection}
              confidence={demand.data.confidence}
            />
            <ExplanationList items={demand.data.explanation} />
            <Disclaimer modelVersion={demand.data.modelVersion} asOf={fmt.date(demand.data.asOf)} />
          </div>
        )}
      </Card>
    </div>
  );
}
