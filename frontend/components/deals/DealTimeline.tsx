'use client';

import { useTranslations } from 'next-intl';
import { useFmt } from '@/components/useFmt';
import type { DealEvent } from '@/lib/types';
import type { DealView } from '@/lib/views';

/** Full negotiation history: who did what and when (PRD 7.1). */
export function DealTimeline({ deal }: { deal: DealView }) {
  const t = useTranslations('deals.timeline');
  const fmt = useFmt();

  const who = (e: DealEvent) =>
    e.actorParty === deal.myParty ? t('you') : e.actorParty === 'farmer' ? deal.farmerName : deal.companyName;

  const what = (e: DealEvent) => {
    if (e.from === null) return e.to === 'enquiry' ? t('openedEnquiry', { qty: fmt.qty(e.qtyKg ?? deal.qtyKg) }) : t('openedOffer', { qty: fmt.qty(e.qtyKg ?? deal.qtyKg), price: fmt.perQuintal(e.pricePerQuintal ?? 0) });
    if (e.to === 'offer_sent') return t('offered', { price: fmt.perQuintal(e.pricePerQuintal ?? 0) });
    if (e.to === 'negotiation') return t('countered', { price: fmt.perQuintal(e.pricePerQuintal ?? 0) });
    return t(e.to);
  };

  return (
    <ol className="relative space-y-4 border-l-2 border-leaf-200 pl-5">
      {deal.events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-leaf-600" />
          <p className="font-medium text-gray-900">
            <span className="font-semibold">{who(e)}</span> {what(e)}
          </p>
          {e.note && <p className="mt-0.5 rounded-lg bg-gray-50 px-2 py-1 text-gray-700">“{e.note}”</p>}
          <p className="text-sm text-gray-500">{fmt.dateTime(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}
