'use client';

import { useTranslations } from 'next-intl';
import { CropArt } from '@/components/ui/CropArt';
import type { Recommendation } from '@/lib/types';

/**
 * The ranked crops side by side, so the gaps between them are visible at a
 * glance -- the cards below say *why* each one ranks where it does.
 *
 * Plain CSS bars rather than a chart library: this route should not pull in
 * Recharts for five horizontal bars.
 */
export function ScoreChart({ recs }: { recs: Recommendation[] }) {
  const t = useTranslations('advice');
  const tCrop = useTranslations('crops');
  const top = Math.max(...recs.map((r) => r.score), 0.0001);

  return (
    <ol className="space-y-2.5">
      {recs.map((rec) => {
        // Bars are scaled against the best crop, so the leader always fills the
        // track and the rest read as "how far behind".
        const width = Math.max(6, (rec.score / top) * 100);
        return (
          <li key={rec.cropId} className="flex items-center gap-3">
            <CropArt cropId={rec.cropId} size={32} tile={false} className="shrink-0" />
            <span className="w-24 shrink-0 truncate font-medium text-gray-900">{tCrop(rec.cropId)}</span>
            <span className="h-7 min-w-0 flex-1 rounded-md bg-leaf-100">
              <span
                className={`flex h-7 items-center justify-end rounded-md px-2 text-sm font-semibold tabular-nums ${
                  rec.rank === 1 ? 'bg-haldi-500 text-white' : 'bg-leaf-300 text-leaf-800'
                }`}
                style={{ width: `${width}%` }}
              >
                {Math.round(rec.score * 100)}
              </span>
            </span>
          </li>
        );
      })}
      <li className="pt-1 text-sm text-gray-600">{t('scoreHint')}</li>
    </ol>
  );
}
