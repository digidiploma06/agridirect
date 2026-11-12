'use client';

import { useTranslations } from 'next-intl';
import { VerificationBadge, VerificationNotice } from '@/components/company/VerificationNotice';
import { DealCard } from '@/components/deals/DealCard';
import { ListingMatchRow } from '@/components/matches/ListingMatchRow';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorNote, Loading } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function CompanyDashboard() {
  const t = useTranslations('company.dashboard');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const { session } = useSession();
  const requirements = useApi(() => api.listMyRequirements(), []);
  const deals = useApi(() => api.listMyDeals(), []);
  const verified = session?.user.status === 'verified';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{session?.company?.companyName}</h1>
        {session && <VerificationBadge status={session.user.status} />}
      </div>
      {session && <VerificationNotice session={session} />}

      <div className="flex flex-wrap gap-2">
        {verified && (
          <ButtonLink href="/company/requirements/new">
            {t('post')}
          </ButtonLink>
        )}
        <ButtonLink href="/company/browse" variant="secondary">
          {t('browse')}
        </ButtonLink>
      </div>

      <Card title={t('dealsTitle')}>
        {deals.loading && <Loading />}
        <ErrorNote code={deals.error} onRetry={deals.reload} />
        {deals.data?.length === 0 && <p className="text-gray-600">{t('dealsEmpty')}</p>}
        <div className="space-y-2">
          {deals.data?.slice(0, 5).map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('requirementsTitle')}</h2>
        {requirements.loading && <Loading />}
        <ErrorNote code={requirements.error} onRetry={requirements.reload} />
        {requirements.data?.length === 0 && <EmptyState title={t('requirementsEmpty')} />}
        {requirements.data?.map(({ requirement: r, matches }) => (
          <Card
            key={r.id}
            title={`${tCrop(r.cropId)} · ${fmt.qty(r.qtyKg)}`}
            action={<span className="text-sm text-gray-600">{t('by', { date: fmt.date(r.requiredBy) })}</span>}
          >
            <p className="mb-3 text-gray-700">
              {fmt.perQuintal(r.priceMin)}–{fmt.perQuintal(r.priceMax)}
              {r.notes && <> · {r.notes}</>}
            </p>
            <h3 className="mb-2 font-semibold">{t('matchesTitle', { count: matches.length })}</h3>
            {matches.length === 0 ? (
              <p className="text-gray-600">{t('noMatches')}</p>
            ) : (
              <div className="space-y-2">
                {matches.slice(0, 3).map((m) => (
                  <ListingMatchRow key={m.listingId} listing={m.listing} score={m.score} breakdown={m.breakdown} requirement={r} canOffer={verified} />
                ))}
              </div>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
