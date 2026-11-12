'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import * as api from '@/lib/api';
import { useAppLocale } from '@/lib/hooks';
import { LOCALE_LABELS, isLocale, setLocaleCookie } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { LOCALES } from '@/lib/types';

export function LanguageSwitcher() {
  const t = useTranslations('common');
  const locale = useAppLocale();
  const router = useRouter();
  const { session } = useSession();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    if (!isLocale(value)) return;
    setLocaleCookie(value);
    if (session) void api.updateLanguage(value);
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-1 text-sm text-leaf-600">
      <Languages aria-hidden className="hidden h-4 w-4 sm:block" />
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        className="h-10 max-w-[6rem] rounded-full border border-leaf-300 bg-white px-3 text-sm text-leaf-800 sm:max-w-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
