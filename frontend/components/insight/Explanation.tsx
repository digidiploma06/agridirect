'use client';

import { useTranslations } from 'next-intl';
import type { Explanation } from '@/lib/types';

/** Renders templated explanations (SHAP-driver stand-ins) in the current language. */
export function useExplain() {
  const t = useTranslations('advice.explain');
  return (e: Explanation) => (t.has(e.key) ? t(e.key, e.params) : e.key);
}

export function ExplanationList({ items }: { items: Explanation[] }) {
  const explain = useExplain();
  return (
    <ul className="list-disc space-y-1 pl-5 text-gray-700">
      {items.map((e, i) => (
        <li key={`${e.key}-${i}`}>{explain(e)}</li>
      ))}
    </ul>
  );
}
