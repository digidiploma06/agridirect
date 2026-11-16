'use client';

import { useTranslations } from 'next-intl';
import type { DealStatus } from '@/lib/types';

/** Where deals are now, in the order they move through. */
const FLOW: DealStatus[] = ['enquiry', 'offer_sent', 'negotiation', 'accepted', 'completed'];
/** Outcomes that end a deal early; shown apart so they do not read as a stage. */
const ENDED: DealStatus[] = ['rejected', 'cancelled'];

export function DealFunnel({ counts }: { counts: Record<DealStatus, number> }) {
  const t = useTranslations('admin.overview');
  const tStatus = useTranslations('dealStatus');
  const peak = Math.max(...FLOW.map((s) => counts[s] ?? 0), 1);

  return (
    <div className="space-y-4">
      <ol className="flex items-end gap-2">
        {FLOW.map((s) => {
          const n = counts[s] ?? 0;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span className="font-semibold tabular-nums text-leaf-800">{n}</span>
              <span className="flex h-28 w-full items-end">
                <span
                  className={`w-full rounded-t-md ${s === 'completed' ? 'bg-haldi-500' : 'bg-leaf-300'}`}
                  // A zero stage still shows a sliver, so the row never looks broken.
                  style={{ height: `${Math.max(3, (n / peak) * 100)}%` }}
                />
              </span>
              <span className="w-full truncate text-center text-sm text-gray-600" title={tStatus(s)}>
                {tStatus(s)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-leaf-100 pt-3 text-sm text-gray-600">
        {ENDED.map((s) => (
          <span key={s}>
            {tStatus(s)} <span className="font-semibold tabular-nums text-gray-900">{counts[s] ?? 0}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
