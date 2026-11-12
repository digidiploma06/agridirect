'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RequirementForm } from '@/components/company/RequirementForm';
import { VerificationNotice } from '@/components/company/VerificationNotice';
import { Card, PageHeader } from '@/components/ui/Card';
import { useSession } from '@/lib/session';

export default function NewRequirementPage() {
  const t = useTranslations('requirement');
  const router = useRouter();
  const { session } = useSession();
  if (!session?.company) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <VerificationNotice session={session} />
      <Card>
        <RequirementForm company={session.company} disabled={session.user.status !== 'verified'} onCreated={() => router.push('/company')} />
      </Card>
    </div>
  );
}
