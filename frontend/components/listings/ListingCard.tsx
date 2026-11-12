'use client';

import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ListingStatusBadge } from '@/components/deals/StatusBadge';
import { useDistrictName } from '@/components/forms/options';
import { useFmt } from '@/components/useFmt';
import type { ListingView } from '@/lib/views';

interface Props {
  listing: ListingView;
  href?: string;
  extra?: ReactNode;
  footer?: ReactNode;
}

export function ListingCard({ listing, href, extra, footer }: Props) {
  const t = useTranslations('listings');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const districtName = useDistrictName();
  const partial = listing.qtyRemainingKg < listing.qtyKg;

  const body = (
    <div className="flex items-start gap-3">
      {listing.photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
        <img src={listing.photos[0]} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{tCrop(listing.cropId)}</span>
          <span className="text-gray-600">{listing.variety}</span>
          {listing.status !== 'active' && <ListingStatusBadge status={listing.status} />}
          {extra}
        </div>
        <p className="font-medium text-gray-900">
          {partial
            ? t('remainingOf', { remaining: fmt.qty(listing.qtyRemainingKg), total: fmt.qty(listing.qtyKg) })
            : fmt.qty(listing.qtyKg)}
          {listing.expectedPrice !== undefined && <span className="font-normal text-gray-600"> · {fmt.perQuintal(listing.expectedPrice)}</span>}
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <CalendarDays aria-hidden className="h-4 w-4" />
            {t('readyOn', { date: fmt.date(listing.readyDate) })}
          </span>
          <span className="flex items-center gap-1">
            <MapPin aria-hidden className="h-4 w-4" />
            {listing.village}, {districtName(listing.districtId)}
            {listing.distanceKm !== undefined && <> · ~{fmt.km(listing.distanceKm)}</>}
          </span>
        </p>
      </div>
      {href && <ChevronRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-gray-400" />}
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {href ? (
        <Link href={href} className="block rounded-lg p-4 hover:bg-leaf-50">
          {body}
        </Link>
      ) : (
        <div className="p-4">{body}</div>
      )}
      {footer && <div className="border-t border-gray-100 p-3">{footer}</div>}
    </div>
  );
}
