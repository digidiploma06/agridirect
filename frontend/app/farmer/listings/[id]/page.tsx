'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { DealCard } from '@/components/deals/DealCard';
import { ListingCard } from '@/components/listings/ListingCard';
import { ListingInsightCard } from '@/components/listings/ListingInsightCard';
import { RequirementMatchRow } from '@/components/matches/RequirementMatchRow';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorNote, Loading, Notice } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';

function ListingDetailInner({ id }: { id: string }) {
  const t = useTranslations('listings.detail');
  const created = useSearchParams().get('created') === '1';
  const detail = useApi(() => api.getListing(id), [id]);
  const toggle = useAction(api.setListingStatus);

  if (detail.loading && !detail.data) return <Loading />;
  if (detail.error || !detail.data) return <ErrorNote code={detail.error} onRetry={detail.reload} />;
  const { listing, insight, matches, deals } = detail.data;
  const canToggle = listing.status === 'active' || listing.status === 'paused';

  async function onToggle() {
    await toggle.run(listing.id, listing.status === 'active' ? 'paused' : 'active');
    detail.reload();
  }

  return (
    <div className="space-y-4">
      <ButtonLink href="/farmer/listings" variant="ghost" className="-ml-3">
        ← {t('back')}
      </ButtonLink>
      {created && (
        <Notice tone="success">
          {t('created')}
        </Notice>
      )}
      <ListingCard
        listing={listing}
        footer={
          canToggle && (
            <Button
              variant="secondary"
              onClick={onToggle}
              loading={toggle.pending}
            >
              {listing.status === 'active' ? t('pause') : t('resume')}
            </Button>
          )
        }
      />
      <ErrorNote code={toggle.error} />

      <ListingInsightCard insight={insight} />

      <Card title={t('matchesTitle')}>
        {matches.length === 0 ? (
          <p className="text-gray-600">{listing.status === 'active' ? t('noMatches') : t('pausedNoMatches')}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">{t('matchesHint')}</p>
            <ul className="space-y-2">
              {matches.map((m) => (
                <RequirementMatchRow key={m.requirementId} match={m} />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title={t('dealsTitle')}>
        {deals.length === 0 ? (
          <p className="text-gray-600">{t('noDeals')}</p>
        ) : (
          <div className="space-y-2">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Loading />}>
      <ListingDetailInner id={params.id} />
    </Suspense>
  );
}
