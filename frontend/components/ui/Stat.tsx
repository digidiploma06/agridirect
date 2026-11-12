import type { ReactNode } from 'react';

export function Stat({ label, value, hint, tone = 'default' }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'alert' }) {
  return (
    <div className={`rounded-md border bg-white p-3 ${tone === 'alert' ? 'border-haldi-400 border-l-4' : 'border-gray-300'}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-sm text-gray-500">{hint}</div>}
    </div>
  );
}
