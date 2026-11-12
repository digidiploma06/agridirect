'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/States';
import type { Session } from '@/lib/views';

export function VerificationBadge({ status }: { status: Session['user']['status'] }) {
  const t = useTranslations('company.verification');
  if (status === 'verified') return <Badge tone="green">{t('verified')}</Badge>;
  if (status === 'pending') return <Badge tone="amber">{t('pending')}</Badge>;
  return <Badge tone="red">{t('rejected')}</Badge>;
}

/** PRD 7.2: a Pending company cannot post requirements or send offers. */
export function VerificationNotice({ session }: { session: Session }) {
  const t = useTranslations('company.verification');
  if (session.user.status === 'pending') return <Notice tone="warn">{t('pendingBody')}</Notice>;
  if (session.user.status === 'rejected') {
    return <Notice tone="warn">{t('rejectedBody', { reason: session.company?.rejectionReason ?? '' })}</Notice>;
  }
  return null;
}
