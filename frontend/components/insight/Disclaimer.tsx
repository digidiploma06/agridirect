'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Advisory disclaimer, always visible next to predictions (PRD 7.1, NFR Trust). */
export function Disclaimer({ modelVersion, asOf }: { modelVersion?: string; asOf?: string }) {
  const t = useTranslations('common');
  return (
    <p className="flex items-start gap-2 rounded-md bg-gray-100 p-3 text-sm text-gray-700">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {t('disclaimer')}
        {modelVersion && <> · {t('modelVersion', { version: modelVersion })}</>}
        {asOf && <> · {t('asOf', { date: asOf })}</>}
      </span>
    </p>
  );
}
