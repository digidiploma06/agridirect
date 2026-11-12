'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { useFmt } from '@/components/useFmt';
import type { DealView } from '@/lib/views';
import { DealStatusBadge } from './StatusBadge';

export function DealCard({ deal }: { deal: DealView }) {
  const t = useTranslations('deals');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const myTurn = deal.myParty !== null && deal.awaiting === deal.myParty;
  const counterpart = deal.myParty === 'farmer' ? deal.companyName : deal.myParty === 'company' ? `${deal.farmerName}, ${deal.farmerVillage}` : `${deal.farmerName} ↔ ${deal.companyName}`;

  return (
    <Link
      href={`/deals/${deal.id}`}
      className={`flex items-center gap-3 rounded-lg border bg-white p-4 hover:border-leaf-400 ${myTurn ? 'border-haldi-400' : 'border-gray-200'}`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{tCrop(deal.cropId)}</span>
          <DealStatusBadge status={deal.status} />
          {myTurn && <Badge tone="amber">{t('yourTurn')}</Badge>}
        </div>
        <p className="truncate text-gray-700">{counterpart}</p>
        <p className="text-sm text-gray-600">
          {fmt.qty(deal.qtyKg)}
          {deal.pricePerQuintal !== undefined && <> · {fmt.perQuintal(deal.pricePerQuintal)}</>} · {fmt.date(deal.updatedAt)}
        </p>
      </div>
      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-gray-400" />
    </Link>
  );
}
