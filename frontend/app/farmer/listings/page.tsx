'use client';

import { ClipboardList } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { ListingCard } from '@/components/listings/ListingCard';
import { ListingForm } from '@/components/listings/ListingForm';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState, ErrorNote, Loading } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { CropId } from '@/lib/types';

function ListingsInner() {
  const t = useTranslations('listings');
  const params = useSearchParams();
  const router = useRouter();
  const farmer = useSession().session?.farmer;
  const [creating, setCreating] = useState(params.get('new') === '1');
  const listings = useApi(() => api.listMyListings(), []);
  const initialCrop = (api.getCrop(params.get('crop') ?? '')?.id ?? undefined) as CropId | undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              {t('new')}
            </Button>
          )
        }
      />

      {creating && farmer && (
        <Card title={t('form.title')}>
          <ListingForm
            farmer={farmer}
            initialCrop={initialCrop}
            onCancel={() => setCreating(false)}
            onCreated={(l) => router.push(`/farmer/listings/${l.id}?created=1`)}
          />
        </Card>
      )}

      {listings.loading && <Loading />}
      <ErrorNote code={listings.error} onRetry={listings.reload} />
      {listings.data?.length === 0 && !creating && (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title={t('empty')}>
          {t('emptyHint')}
        </EmptyState>
      )}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {listings.data?.map((l) => (
          <ListingCard key={l.id} listing={l} href={`/farmer/listings/${l.id}`} />
        ))}
      </div>
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ListingsInner />
    </Suspense>
  );
}
