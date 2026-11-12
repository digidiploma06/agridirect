'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function Loading({ label }: { label?: string }) {
  const t = useTranslations('common');
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-gray-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-leaf-600 border-t-transparent" />
      {label ?? t('loading')}
    </div>
  );
}

/** Shows a translated message for an API error code. */
export function ErrorNote({ code, onRetry }: { code: string | null; onRetry?: () => void }) {
  const t = useTranslations();
  if (!code) return null;
  const key = `errors.${code}`;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
      <span>{t.has(key) ? t(key) : t('errors.unknown')}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-touch font-semibold underline">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
      {icon && <div className="text-leaf-600">{icon}</div>}
      <p className="font-medium text-gray-800">{title}</p>
      {children && <div className="text-gray-600">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'success'; icon?: ReactNode; children: ReactNode }) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-haldi-400 bg-haldi-50 text-haldi-700',
    success: 'border-leaf-300 bg-leaf-50 text-leaf-900',
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 ${styles}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
