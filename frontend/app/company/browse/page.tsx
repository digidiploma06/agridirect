'use client';

import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { VerificationNotice } from '@/components/company/VerificationNotice';
import { CropOptions, DistrictOptions } from '@/components/forms/options';
import { ListingMatchRow } from '@/components/matches/ListingMatchRow';
import { Card, PageHeader } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorNote, Loading } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { BrowseFilters } from '@/lib/views';

const RADII = [25, 50, 100, 200];

export default function BrowsePage() {
  const t = useTranslations('browse');
  const { session } = useSession();
  const [filters, setFilters] = useState<BrowseFilters>({ radiusKm: 200 });
  const [minQtyT, setMinQtyT] = useState('');
  const results = useApi(() => api.browseListings(filters), [JSON.stringify(filters)]);
  const requirements = useApi(() => api.listMyRequirements(), []);
  const verified = session?.user.status === 'verified';
  const set = (patch: Partial<BrowseFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {session && <VerificationNotice session={session} />}

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField label={t('crop')} value={filters.cropId ?? ''} onChange={(e) => set({ cropId: e.target.value || undefined })}>
            <CropOptions placeholder={t('all')} />
          </SelectField>
          <SelectField label={t('district')} value={filters.districtId ?? ''} onChange={(e) => set({ districtId: e.target.value || undefined })}>
            <DistrictOptions placeholder={t('all')} />
          </SelectField>
          <TextField
            label={t('minQty')}
            inputMode="decimal"
            value={minQtyT}
            onChange={(e) => {
              setMinQtyT(e.target.value);
              const n = Number(e.target.value);
              set({ minQtyKg: n > 0 ? Math.round(n * 1000) : undefined });
            }}
          />
          <TextField label={t('readyBefore')} type="date" value={filters.readyBefore ?? ''} onChange={(e) => set({ readyBefore: e.target.value || undefined })} />
          <SelectField label={t('radius')} value={filters.radiusKm} onChange={(e) => set({ radiusKm: Number(e.target.value) })}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {t('withinKm', { km: r })}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <p className="text-gray-600" aria-live="polite">
        {results.data && t('count', { count: results.data.length })} · {t('sorted')}
      </p>
      {results.loading && !results.data && <Loading />}
      <ErrorNote code={results.error} onRetry={results.reload} />
      {results.data?.length === 0 && <EmptyState icon={<SearchX className="h-8 w-8" />} title={t('empty')} />}
      <div className="space-y-3">
        {results.data?.map(({ listing, bestMatch }) => (
          <ListingMatchRow
            key={listing.id}
            listing={listing}
            score={bestMatch?.score}
            requirement={requirements.data?.find((r) => r.requirement.id === bestMatch?.requirementId)?.requirement}
            canOffer={verified}
          />
        ))}
      </div>
    </div>
  );
}
