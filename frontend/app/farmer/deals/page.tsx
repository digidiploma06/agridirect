'use client';

import { Handshake } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DealCard } from '@/components/deals/DealCard';
import { PageHeader } from '@/components/ui/Card';
import { EmptyState, ErrorNote, Loading } from '@/components/ui/States';
import * as api from '@/lib/api';
import { isTerminal } from '@/lib/deals';
import { useApi } from '@/lib/hooks';
import type { DealView } from '@/lib/views';

function Section({ title, deals }: { title: string; deals: DealView[] }) {
  if (deals.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-800">
        {title} <span className="text-gray-500">({deals.length})</span>
      </h2>
      {deals.map((d) => (
        <DealCard key={d.id} deal={d} />
      ))}
    </section>
  );
}

export default function FarmerDealsPage() {
  const t = useTranslations('deals.inbox');
  const deals = useApi(() => api.listMyDeals(), []);
  const all = deals.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {deals.loading && <Loading />}
      <ErrorNote code={deals.error} onRetry={deals.reload} />
      {deals.data && all.length === 0 && <EmptyState icon={<Handshake className="h-8 w-8" />} title={t('empty')} />}
      <Section title={t('waiting')} deals={all.filter((d) => d.awaiting === 'farmer')} />
      <Section title={t('open')} deals={all.filter((d) => d.awaiting !== 'farmer' && !isTerminal(d.status))} />
      <Section title={t('closed')} deals={all.filter((d) => isTerminal(d.status))} />
    </div>
  );
}
