'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { ErrorNote, Loading } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';

export default function SystemPage() {
  const t = useTranslations('admin.system');
  const tCrop = useTranslations('crops');
  const fmt = useFmt();
  const health = useApi(() => api.getSystemHealth(), []);
  const retry = useAction(api.retryPipeline);

  if (health.loading && !health.data) return <Loading />;
  if (!health.data) return <ErrorNote code={health.error} onRetry={health.reload} />;
  const h = health.data;

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card title={t('pipelinesTitle')}>
        <ul className="grid gap-3 md:grid-cols-3">
          {h.pipeline.map((p) => {
            const ok = p.status === 'ok';
            return (
              <li key={p.source} className={`rounded-md border-2 p-3 ${ok ? 'border-leaf-300 bg-leaf-50' : 'border-red-400 bg-red-50'}`}>
                <p className="flex items-center gap-2 font-semibold">
                  {ok ? <CheckCircle2 aria-hidden className="h-5 w-5 text-leaf-700" /> : <XCircle aria-hidden className="h-5 w-5 text-red-700" />}
                  {t(`sources.${p.source}`)}: {t(`status.${p.status}`)}
                </p>
                <p className="text-sm text-gray-700">{t('lastRun', { at: fmt.dateTime(p.lastRunAt) })}</p>
                <p className="text-sm text-gray-700">{t('records', { n: p.records })}</p>
                {p.message && <p className="text-sm text-gray-600">{p.message}</p>}
                {!ok && (
                  <Button
                    variant="secondary"
                    className="mt-2"
                    loading={retry.pending}
                    onClick={async () => {
                      await retry.run(p.source);
                      health.reload();
                    }}
                  >
                    {t('retry')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={t('modelTitle', { version: h.modelVersion })}>
        <p className="mb-3 text-sm text-gray-600">{t('modelHint')}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead className="text-sm text-gray-600">
              <tr>
                <th className="py-2 pr-3 font-medium">{t('crop')}</th>
                <th className="py-2 pr-3 font-medium">{t('mape')}</th>
                <th className="py-2 pr-3 font-medium">{t('mapeBaseline')}</th>
                <th className="py-2 pr-3 font-medium">{t('f1')}</th>
                <th className="py-2 font-medium">{t('f1Baseline')}</th>
              </tr>
            </thead>
            <tbody>
              {h.metrics.map((m) => (
                <tr key={m.cropId} className="border-t border-gray-100 tabular-nums">
                  <td className="py-2 pr-3 font-medium">{tCrop(m.cropId)}</td>
                  <td className="py-2 pr-3 font-semibold text-leaf-800">{m.mapeModel}%</td>
                  <td className="py-2 pr-3 text-gray-600">{m.mapeBaseline}%</td>
                  <td className="py-2 pr-3 font-semibold text-leaf-800">{m.macroF1.toFixed(2)}</td>
                  <td className="py-2 text-gray-600">{m.macroF1Baseline.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('auditTitle')}>
        <ul className="divide-y divide-gray-100">
          {h.audit.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="font-mono text-sm">{a.action}</span> <span className="text-gray-600">{a.entity}/{a.entityId}</span>
              </span>
              <span className="text-sm text-gray-500">
                {a.actorId} · {fmt.dateTime(a.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
