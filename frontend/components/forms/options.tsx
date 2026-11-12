'use client';

import { useTranslations } from 'next-intl';
import { CROPS, DISTRICTS } from '@/lib/api';
import type { CompanyType, Irrigation, SoilType } from '@/lib/types';

export const IRRIGATION: Irrigation[] = ['rainfed', 'well', 'borewell', 'canal', 'drip'];
export const SOIL: SoilType[] = ['black', 'red', 'alluvial', 'laterite', 'unknown'];
export const COMPANY_TYPES: CompanyType[] = ['feed', 'processor', 'exporter', 'retailer', 'fpo', 'trader', 'institution'];

export function useDistrictName() {
  const t = useTranslations('districts');
  return (id: string) => (t.has(id) ? t(id) : (DISTRICTS.find((d) => d.id === id)?.name ?? id));
}

export function CropOptions({ placeholder }: { placeholder?: string }) {
  const t = useTranslations('crops');
  return (
    <>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {CROPS.map((c) => (
        <option key={c.id} value={c.id}>
          {t(c.id)}
        </option>
      ))}
    </>
  );
}

export function DistrictOptions({ placeholder }: { placeholder?: string }) {
  const name = useDistrictName();
  return (
    <>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {DISTRICTS.map((d) => (
        <option key={d.id} value={d.id}>
          {name(d.id)}
        </option>
      ))}
    </>
  );
}

export function EnumOptions({ ns, values }: { ns: string; values: readonly string[] }) {
  const t = useTranslations(ns);
  return (
    <>
      {values.map((v) => (
        <option key={v} value={v}>
          {t(v)}
        </option>
      ))}
    </>
  );
}
