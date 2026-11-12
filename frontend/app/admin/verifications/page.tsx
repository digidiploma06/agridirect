'use client';

import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useDistrictName } from '@/components/forms/options';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { TextAreaField } from '@/components/ui/Field';
import { EmptyState, ErrorNote, Loading } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import type { VerificationItem } from '@/lib/views';

function VerificationCard({ item, onDone }: { item: VerificationItem; onDone: () => void }) {
  const t = useTranslations('admin.verifications');
  const tType = useTranslations('companyType');
  const fmt = useFmt();
  const districtName = useDistrictName();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const decide = useAction(api.verifyCompany);
  const { company, user } = item;

  async function run(decision: 'approve' | 'reject') {
    await decide.run(user.id, decision, reason);
    onDone();
  }

  return (
    <Card title={company.companyName} action={<span className="text-sm text-gray-600">{t('submitted', { date: fmt.date(company.submittedAt) })}</span>}>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-600">{t('gstin')}</dt>
          <dd className="font-mono">{company.gstin}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-600">{t('type')}</dt>
          <dd>{tType(company.type)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-600">{t('contact')}</dt>
          <dd>
            {company.contactPerson} · {user.phone}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-600">{t('districts')}</dt>
          <dd>{company.operatingDistricts.map(districtName).join(', ')}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-gray-600">{t('documents')}</dt>
          <dd className="text-gray-500">{t('noDocuments')}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-gray-600">{t('gstinChecked')}</p>
      <div className="mt-3 space-y-2">
        {rejecting && <TextAreaField label={t('reason')} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
        <ErrorNote code={decide.error} />
        <div className="flex flex-wrap gap-2">
          {!rejecting && (
            <Button loading={decide.pending} onClick={() => run('approve')}>
              {t('approve')}
            </Button>
          )}
          <Button variant="danger" loading={decide.pending && rejecting} onClick={() => (rejecting ? run('reject') : setRejecting(true))}>
            {rejecting ? t('confirmReject') : t('reject')}
          </Button>
          {rejecting && (
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {t('back')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function VerificationsPage() {
  const t = useTranslations('admin.verifications');
  const queue = useApi(() => api.listVerifications(), []);
  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {queue.loading && !queue.data && <Loading />}
      <ErrorNote code={queue.error} onRetry={queue.reload} />
      {queue.data?.length === 0 && <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title={t('empty')} />}
      {queue.data?.map((item) => (
        <VerificationCard key={item.user.id} item={item} onDone={queue.reload} />
      ))}
    </div>
  );
}
