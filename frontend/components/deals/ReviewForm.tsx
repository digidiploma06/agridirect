'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Field';
import { ErrorNote } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useAction } from '@/lib/hooks';
import type { DealView } from '@/lib/views';

/** Rating after completion (PRD FR-17). */
export function ReviewForm({ deal, onDone }: { deal: DealView; onDone: () => void }) {
  const t = useTranslations('deals.review');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const save = useAction(api.reviewDeal);

  if (deal.review) {
    return (
      <p className="flex items-center gap-1 text-gray-700">
        {t('yourRating')}
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} aria-hidden className={`h-5 w-5 ${i < deal.review!.rating ? 'fill-haldi-400 text-haldi-400' : 'text-gray-300'}`} />
        ))}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-800">{t('prompt')}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-pressed={rating === n} className="flex min-h-touch min-w-touch items-center justify-center rounded-lg hover:bg-haldi-50">
              <Star aria-hidden className={`h-7 w-7 ${n <= rating ? 'fill-haldi-400 text-haldi-400' : 'text-gray-300'}`} />
              <span className="sr-only">{t('stars', { n })}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <TextAreaField label={t('comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
      <ErrorNote code={save.error} />
      <Button
        disabled={rating === 0}
        loading={save.pending}
        onClick={async () => {
          await save.run(deal.id, rating, comment || undefined);
          onDone();
        }}
      >
        {t('submit')}
      </Button>
    </div>
  );
}
