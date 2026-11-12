'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { OfferForm } from '@/components/deals/OfferForm';
import { ListingCard } from '@/components/listings/ListingCard';
import { Button } from '@/components/ui/Button';
import type { Requirement } from '@/lib/types';
import type { ListingView } from '@/lib/views';
import { ScoreBreakdown, ScorePill } from './ScoreBreakdown';

interface Props {
  listing: ListingView;
  score?: number;
  breakdown?: Parameters<typeof ScoreBreakdown>[0]['breakdown'];
  requirement?: Pick<Requirement, 'id' | 'priceMin' | 'priceMax' | 'qtyKg'>;
  canOffer: boolean;
}

/** A farmer listing as seen by a company, with score and an inline offer form. */
export function ListingMatchRow({ listing, score, breakdown, requirement, canOffer }: Props) {
  const t = useTranslations('matches');
  const [offering, setOffering] = useState(false);
  const midPrice = requirement ? Math.round((requirement.priceMin + requirement.priceMax) / 2) : undefined;

  return (
    <ListingCard
      listing={listing}
      extra={score !== undefined && <ScorePill score={score} />}
      footer={
        <div className="space-y-2">
          {breakdown && (
            <details>
              <summary className="min-h-touch cursor-pointer py-2 text-sm font-medium text-leaf-800">{t('howScored')}</summary>
              <ScoreBreakdown breakdown={breakdown} />
            </details>
          )}
          {offering ? (
            <OfferForm
              listing={listing}
              requirementId={requirement?.id}
              suggestedPrice={midPrice}
              suggestedQtyKg={requirement?.qtyKg}
              onCancel={() => setOffering(false)}
            />
          ) : (
            <Button variant="secondary" disabled={!canOffer} onClick={() => setOffering(true)}>
              {canOffer ? t('makeOffer') : t('verifyToOffer')}
            </Button>
          )}
        </div>
      }
    />
  );
}
