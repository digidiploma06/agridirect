'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi, useAppLocale } from '@/lib/hooks';
import type { AppNotification } from '@/lib/types';

export function useNotificationText() {
  const t = useTranslations('notifications');
  const tCrop = useTranslations('crops');
  return (n: AppNotification) => {
    const crop = typeof n.params.crop === 'string' && n.params.crop ? tCrop(n.params.crop) : '';
    return t(n.template, { ...n.params, crop });
  };
}

/** In-app notifications (PRD FR-13, in-app channel). */
export function NotificationBell() {
  const t = useTranslations('common');
  const locale = useAppLocale();
  const pathname = usePathname();
  const text = useNotificationText();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, reload } = useApi(() => api.listNotifications(), [pathname]);
  const unread = data?.filter((n) => !n.read).length ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api.markNotificationsRead();
      reload();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} className="relative flex min-h-touch min-w-touch items-center justify-center rounded-full text-leaf-600 hover:bg-leaf-100 hover:text-leaf-800">
        <Bell aria-hidden className="h-5 w-5" />
        <span className="sr-only">{t('notifications')}</span>
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-haldi-600 px-1 text-xs font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[90vw] rounded-2xl border border-leaf-200 bg-white p-2 shadow-lg">
          {!data?.length && <p className="p-3 text-gray-600">{t('noNotifications')}</p>}
          <ul className="max-h-96 overflow-y-auto">
            {data?.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? '#'} onClick={() => setOpen(false)} className="block rounded-md p-3 hover:bg-gray-50">
                  <p className="text-gray-900">{text(n)}</p>
                  <p className="text-sm text-gray-500">{formatDateTime(n.createdAt, locale)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
