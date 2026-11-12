'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { ErrorNote, Notice } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { useFmt } from '@/components/useFmt';
import type { DealAction } from '@/lib/types';
import type { DealView } from '@/lib/views';

type Mode = null | 'counter' | 'send_offer' | 'reject' | 'cancel';

/** Buttons for exactly the transitions the state machine allows this party. */
export function DealActions({ deal, onDone }: { deal: DealView; onDone: () => void }) {
  const t = useTranslations('deals.actions');
  const tc = useTranslations('common');
  const [mode, setMode] = useState<Mode>(null);
  const [price, setPrice] = useState(String(deal.pricePerQuintal ?? ''));
  const [note, setNote] = useState('');
  const act = useAction(api.actOnDeal);
  const fmt = useFmt();
  const can = (a: DealAction) => deal.allowed.includes(a);

  async function run(action: DealAction) {
    const withPrice = action === 'counter' || action === 'send_offer';
    const res = await act.run(deal.id, { action, pricePerQuintal: withPrice ? Number(price) : undefined, note: note || undefined });
    if (res) {
      setMode(null);
      setNote('');
      onDone();
    }
  }

  if (deal.allowed.length === 0) return null;

  if (mode) {
    const needsPrice = mode === 'counter' || mode === 'send_offer';
    return (
      <div className="space-y-3">
        {needsPrice && <TextField label={t('pricePerQuintal')} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} autoFocus />}
        <TextAreaField label={mode === 'cancel' ? t('reasonRequired') : `${t('note')} (${tc('optional')})`} value={note} onChange={(e) => setNote(e.target.value)} />
        <ErrorNote code={act.error} />
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === 'cancel' || mode === 'reject' ? 'danger' : 'primary'} loading={act.pending} onClick={() => run(mode)}>
            {t(`confirm.${mode}`)}
          </Button>
          <Button variant="ghost" onClick={() => setMode(null)}>
            {tc('back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {can('accept') && deal.myParty === 'farmer' && <Notice tone="warn">{t('paymentWarning')}</Notice>}
      <div className="flex flex-wrap gap-2">
        {can('accept') && (
          <Button loading={act.pending} onClick={() => run('accept')}>
            {t('accept', { price: fmt.perQuintal(deal.pricePerQuintal ?? 0) })}
          </Button>
        )}
        {can('send_offer') && (
          <Button onClick={() => setMode('send_offer')}>
            {t('sendOffer')}
          </Button>
        )}
        {can('counter') && (
          <Button variant="secondary" onClick={() => setMode('counter')}>
            {t('counter')}
          </Button>
        )}
        {can('complete') && (
          <Button loading={act.pending} onClick={() => run('complete')}>
            {t('complete')}
          </Button>
        )}
        {can('reject') && (
          <Button variant="danger" onClick={() => setMode('reject')}>
            {t('reject')}
          </Button>
        )}
        {can('cancel') && (
          <Button variant="ghost" onClick={() => setMode('cancel')}>
            {t('cancel')}
          </Button>
        )}
      </div>
      <ErrorNote code={act.error} />
    </div>
  );
}
