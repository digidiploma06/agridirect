'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/Field';

export interface Consent {
  account: boolean;
  marketing: boolean;
  age: boolean;
}

/** Separate consents per DPDP guidance (Security & Privacy v1.0, section 8). */
export function ConsentBlock({ value, onChange }: { value: Consent; onChange: (v: Consent) => void }) {
  const t = useTranslations('onboarding.consent');
  return (
    <fieldset className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-800">{t('title')}</legend>
      <p className="text-sm text-gray-700">
        {t('summary')}{' '}
        <Link href="/privacy" target="_blank" className="font-medium text-leaf-800 underline">
          {t('readNotice')}
        </Link>
      </p>
      <Checkbox required label={t('account')} checked={value.account} onChange={(account) => onChange({ ...value, account })} />
      <Checkbox label={t('marketing')} checked={value.marketing} onChange={(marketing) => onChange({ ...value, marketing })} />
      <Checkbox required label={t('age')} checked={value.age} onChange={(age) => onChange({ ...value, age })} />
    </fieldset>
  );
}
