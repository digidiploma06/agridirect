'use client';

import { Lock, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DealActions } from '@/components/deals/DealActions';
import { DealTimeline } from '@/components/deals/DealTimeline';
import { ReviewForm } from '@/components/deals/ReviewForm';
import { DealStatusBadge } from '@/components/deals/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorNote, Loading } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useApi } from '@/lib/hooks';

function PartyRow({ role, name, phone, revealed }: { role: string; name: string; phone: string; revealed: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 pt-0.5 text-xs uppercase tracking-wide text-gray-500">{role}</span>
      <div className="flex-1">
        <p className="font-medium">{name}</p>
        <p className="flex items-center gap-1 text-sm tabular-nums text-gray-600">
          {revealed ? <Phone aria-hidden className="h-4 w-4" /> : <Lock aria-hidden className="h-4 w-4" />}
          {revealed ? <a href={`tel:${phone}`} className="underline">{phone}</a> : phone}
        </p>
      </div>
    </div>
  );
}

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('deals.detail');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const router = useRouter();
  const deal = useApi(() => api.getDeal(params.id), [params.id]);

  if (deal.loading && !deal.data) return <Loading />;
  if (deal.error || !deal.data) return <ErrorNote code={deal.error} onRetry={deal.reload} />;
  const d = deal.data;
  const revealed = d.status === 'accepted' || d.status === 'completed';
  const myTurn = d.myParty !== null && d.awaiting === d.myParty;

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="-ml-3" onClick={() => router.back()}>
        ← {t('back')}
      </Button>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">
            {tCrop(d.cropId)} <span className="font-normal text-gray-600">{d.listingVariety}</span>
          </h1>
          <DealStatusBadge status={d.status} />
          {myTurn && <Badge tone="amber">{t('yourTurn')}</Badge>}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-gray-600">{t('quantity')}</dt>
            <dd className="text-lg font-semibold">{fmt.qty(d.qtyKg)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">{t('price')}</dt>
            <dd className="text-lg font-semibold">{d.pricePerQuintal !== undefined ? fmt.perQuintal(d.pricePerQuintal) : '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">{t('value')}</dt>
            <dd className="text-lg font-semibold">{d.pricePerQuintal !== undefined ? fmt.rupees((d.qtyKg / 100) * d.pricePerQuintal) : '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">{t('listingLeft')}</dt>
            <dd className="text-lg font-semibold">{fmt.qty(d.listingRemainingKg)}</dd>
          </div>
        </dl>
      </Card>

      <Card title={t('parties')}>
        <div className="space-y-3">
          <PartyRow role={t('farmer')} name={`${d.farmerName}, ${d.farmerVillage}`} phone={d.farmerPhone} revealed={revealed || d.myParty === 'farmer'} />
          <PartyRow role={t('buyer')} name={d.companyName} phone={d.companyPhone} revealed={revealed || d.myParty === 'company'} />
          {!revealed && <p className="text-sm text-gray-600">{t('phoneHidden')}</p>}
        </div>
      </Card>

      {d.allowed.length > 0 && (
        <Card title={myTurn ? t('yourMove') : t('actions')}>
          <DealActions deal={d} onDone={deal.reload} />
        </Card>
      )}
      {!myTurn && d.awaiting && d.myParty && <p className="text-gray-600">{t('waitingOther')}</p>}

      {d.status === 'completed' && d.myParty && (
        <Card title={t('reviewTitle')}>
          <ReviewForm deal={d} onDone={deal.reload} />
        </Card>
      )}

      <Card title={t('history')}>
        <DealTimeline deal={d} />
      </Card>
    </div>
  );
}
