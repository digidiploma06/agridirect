'use client';

import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
  const seed = useAction(api.seedMarketData);
  const [seeded, setSeeded] = useState<number | null>(null);

  // One request only inserts a capped slice of rows (the serverless time limit),
  // so keep calling until the backend reports nothing left. The pass limit stops
  // a failing call from spinning forever.
  async function loadDemoData() {
    let total = 0;
    setSeeded(0);
    for (let pass = 0; pass < 40; pass += 1) {
      const res = await seed.run();
      if (!res) break;
      total += res.inserted;
      setSeeded(total);
      if (res.remaining === 0) break;
    }
    health.reload();
  }

  if (health.loading && !health.data) return <Loading />;
  if (!health.data) return <ErrorNote code={health.error} onRetry={health.reload} />;
  const h = health.data;

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={h.canRunPipeline ? t('subtitle') : t('subtitleExternal')} />

      <Card title={t('pipelinesTitle')}>
        <ul className="grid gap-3 md:grid-cols-3">
          {h.pipeline.map((p) => {
            const ok = p.status === 'ok';
            // A deployment that cannot run the pipeline has not *failed* at it, so
            // no red alarm and no retry button that could only answer 409.
            const elsewhere = !ok && !h.canRunPipeline;
            const tone = ok ? 'border-leaf-300 bg-leaf-50' : elsewhere ? 'border-gray-300 bg-white' : 'border-red-400 bg-red-50';
            const icon = ok ? CheckCircle2 : elsewhere ? MinusCircle : XCircle;
            const Icon = icon;
            return (
              <li key={p.source} className={`rounded-md border-2 p-3 ${tone}`}>
                <p className="flex items-center gap-2 font-semibold">
                  <Icon aria-hidden className={`h-5 w-5 ${ok ? 'text-leaf-700' : elsewhere ? 'text-gray-500' : 'text-red-700'}`} />
                  {t(`sources.${p.source}`)}: {elsewhere ? t('status.notHere') : t(`status.${p.status}`)}
                </p>
                {!elsewhere && <p className="text-sm text-gray-700">{t('lastRun', { at: fmt.dateTime(p.lastRunAt) })}</p>}
                {!elsewhere && <p className="text-sm text-gray-700">{t('records', { n: p.records })}</p>}
                {p.message && !elsewhere && <p className="text-sm text-gray-600">{p.message}</p>}
                {!ok && !elsewhere && (
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

      <Card title={t('marketDataTitle')}>
        <p className="text-sm text-gray-700">{t('marketRows', { n: fmt.num(h.marketRows, 0) })}</p>
        {h.marketRows === 0 && <p className="mt-1 font-medium text-haldi-700">{t('marketEmpty')}</p>}
        {!h.canRunPipeline && <p className="mt-1 text-sm text-gray-600">{t('pipelineExternal')}</p>}
        <ErrorNote code={seed.error} />
        {seed.pending && seeded !== null && <p className="mt-2 text-sm text-gray-700">{t('seedProgress', { n: fmt.num(seeded, 0) })}</p>}
        <Button variant="secondary" className="mt-3" loading={seed.pending} onClick={loadDemoData}>
          {t('seedMarket')}
        </Button>
        <p className="mt-2 text-sm text-gray-600">{t('seedHint')}</p>
      </Card>

      <Card title={t('modelTitle', { version: h.modelVersion })}>
        {h.metrics.length === 0 && <p className="text-sm text-gray-700">{t('noMetrics')}</p>}
        {h.metrics.length > 0 && <p className="mb-3 text-sm text-gray-600">{t('modelHint')}</p>}
        <div className={h.metrics.length === 0 ? 'hidden' : 'overflow-x-auto'}>
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
