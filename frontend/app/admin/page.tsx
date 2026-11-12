'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FlagQueue } from '@/components/admin/FlagQueue';
import { DealCard } from '@/components/deals/DealCard';
import { Card, PageHeader } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { ErrorNote, Loading } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useApi } from '@/lib/hooks';
import type { DealStatus } from '@/lib/types';

const STATUSES: DealStatus[] = ['enquiry', 'offer_sent', 'negotiation', 'accepted', 'completed', 'rejected', 'cancelled'];

export default function AdminOverviewPage() {
  const t = useTranslations('admin.overview');
  const tStatus = useTranslations('dealStatus');
  const overview = useApi(() => api.getAdminOverview(), []);

  if (overview.loading && !overview.data) return <Loading />;
  if (!overview.data) return <ErrorNote code={overview.error} onRetry={overview.reload} />;
  const o = overview.data;

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={t('farmers')} value={o.farmers} />
        <Stat label={t('companies')} value={o.companiesVerified} />
        <Link href="/admin/verifications" className="block">
          <Stat label={t('pending')} value={o.companiesPending} tone={o.companiesPending > 0 ? 'alert' : 'default'} hint={t('review')} />
        </Link>
        <Stat label={t('listings')} value={o.activeListings} />
        <Stat label={t('requirements')} value={o.openRequirements} />
      </div>

      <Card title={t('dealsTitle')}>
        <ul className="mb-4 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <li key={s} className="rounded-md border border-gray-200 px-3 py-2">
              <span className="text-sm text-gray-600">{tStatus(s)}</span> <span className="font-bold">{o.dealsByStatus[s]}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          {o.recentDeals.map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </div>
      </Card>

      <Card title={t('flagsTitle', { count: o.flags.length })}>
        <FlagQueue flags={o.flags} onChange={overview.reload} />
      </Card>
    </div>
  );
}
