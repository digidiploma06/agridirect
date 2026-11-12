'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { RecommendationCard } from '@/components/advice/RecommendationCard';
import { DistrictOptions, EnumOptions, IRRIGATION, SOIL } from '@/components/forms/options';
import { Disclaimer } from '@/components/insight/Disclaimer';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorNote } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { currentSeason, todayIso } from '@/lib/dates';
import { useAction } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { AdviceResponse, Irrigation, Season, SoilType } from '@/lib/types';

const SEASONS: Season[] = ['kharif', 'rabi', 'zaid'];

export default function AdvicePage() {
  const t = useTranslations('advice');
  const fmt = useFmt();
  const farmer = useSession().session?.farmer;
  const [districtId, setDistrictId] = useState(farmer?.districtId ?? 'd-pune');
  const [land, setLand] = useState(String(farmer?.landAreaAcres ?? ''));
  const [season, setSeason] = useState<Season>(currentSeason(todayIso()));
  const [irrigation, setIrrigation] = useState<Irrigation>(farmer?.irrigation ?? 'well');
  const [soilType, setSoilType] = useState<SoilType>(farmer?.soilType ?? 'unknown');
  const [result, setResult] = useState<AdviceResponse | null>(null);
  const advice = useAction(api.getAdvice);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await advice.run({ districtId, landAreaAcres: Number(land), season, irrigation, soilType });
    if (res) setResult(res);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card>
        <form onSubmit={submit} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
          <SelectField label={t('district')} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <DistrictOptions />
          </SelectField>
          <TextField label={t('landArea')} inputMode="decimal" value={land} onChange={(e) => setLand(e.target.value)} />
          <SelectField label={t('season')} value={season} onChange={(e) => setSeason(e.target.value as Season)}>
            <EnumOptions ns="seasons" values={SEASONS} />
          </SelectField>
          <SelectField label={t('irrigation')} value={irrigation} onChange={(e) => setIrrigation(e.target.value as Irrigation)}>
            <EnumOptions ns="irrigation" values={IRRIGATION} />
          </SelectField>
          <SelectField label={t('soil')} value={soilType} onChange={(e) => setSoilType(e.target.value as SoilType)}>
            <EnumOptions ns="soil" values={SOIL} />
          </SelectField>
          <div className="flex items-end">
            <Button type="submit" className="w-full" loading={advice.pending}>
              {t('submit')}
            </Button>
          </div>
        </form>
        <div className="mt-3">
          <ErrorNote code={advice.error} />
        </div>
      </Card>

      <Disclaimer modelVersion={result?.modelVersion} asOf={result ? fmt.date(result.asOf) : undefined} />

      {result && (
        <section className="space-y-3" aria-live="polite">
          <h2 className="text-xl font-bold">{t('resultsTitle', { count: result.recommendations.length })}</h2>
          {result.recommendations.length === 0 ? (
            <EmptyState title={t('noResults')} />
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {result.recommendations.map((rec) => (
                <RecommendationCard key={rec.cropId} rec={rec} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
