'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { ErrorNote } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useAction } from '@/lib/hooks';
import type { QtyUnit } from '@/lib/types';
import { toKg, validatePrice, validateQuantity } from '@/lib/validation';
import type { ListingView } from '@/lib/views';

interface Props {
  listing: ListingView;
  requirementId?: string;
  suggestedPrice?: number;
  suggestedQtyKg?: number;
  onCancel: () => void;
}

/** Company sends an offer (priced) or an enquiry (no price) for part or all of a listing. */
export function OfferForm({ listing, requirementId, suggestedPrice, suggestedQtyKg, onCancel }: Props) {
  const t = useTranslations('offer');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const fmt = useFmt();
  const router = useRouter();
  const startKg = Math.min(suggestedQtyKg ?? listing.qtyRemainingKg, listing.qtyRemainingKg);
  const [unit, setUnit] = useState<QtyUnit>(startKg >= 1000 ? 't' : 'q');
  const [quantity, setQuantity] = useState(String(startKg / (startKg >= 1000 ? 1000 : 100)));
  const [price, setPrice] = useState(String(suggestedPrice ?? listing.expectedPrice ?? ''));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useAction(api.createDeal);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const qtyKg = toKg(Number(quantity), unit);
    const priceNum = price ? Number(price) : undefined;
    const err =
      validateQuantity(Number(quantity), unit) ??
      (qtyKg > listing.qtyRemainingKg ? 'qty_exceeds_remaining' : null) ??
      validatePrice(priceNum, false);
    setError(err);
    if (err) return;
    const deal = await create.run({ listingId: listing.id, requirementId, qtyKg, pricePerQuintal: priceNum, note: note || undefined });
    if (deal) router.push(`/deals/${deal.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md bg-leaf-50 p-3" noValidate>
      <p className="text-sm text-gray-700">{t('available', { qty: fmt.qty(listing.qtyRemainingKg) })}</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <TextField label={t('quantity')} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <SelectField label={t('unit')} value={unit} onChange={(e) => setUnit(e.target.value as QtyUnit)}>
          <option value="q">{tc('units.q')}</option>
          <option value="t">{tc('units.t')}</option>
        </SelectField>
      </div>
      <TextField label={t('price')} hint={t('priceHint')} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
      <TextAreaField label={`${t('note')} (${tc('optional')})`} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-700">{te(error)}</p>}
      <ErrorNote code={create.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={create.pending}>
          {price ? t('sendOffer') : t('sendEnquiry')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
