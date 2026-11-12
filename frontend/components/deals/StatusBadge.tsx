'use client';

import { useTranslations } from 'next-intl';
import { Badge, type Tone } from '@/components/ui/Badge';
import type { DealStatus, ListingStatus } from '@/lib/types';

const DEAL_TONE: Record<DealStatus, Tone> = {
  enquiry: 'blue',
  offer_sent: 'amber',
  negotiation: 'amber',
  accepted: 'green',
  completed: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

const LISTING_TONE: Record<ListingStatus, Tone> = { active: 'green', paused: 'gray', sold: 'blue', expired: 'gray' };

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const t = useTranslations('dealStatus');
  return <Badge tone={DEAL_TONE[status]}>{t(status)}</Badge>;
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const t = useTranslations('listingStatus');
  return <Badge tone={LISTING_TONE[status]}>{t(status)}</Badge>;
}
