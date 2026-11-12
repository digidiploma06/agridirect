'use client';

import { Factory } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Disclaimer } from '@/components/insight/Disclaimer';
import { ExplanationList } from '@/components/insight/Explanation';
import { InsightChips } from '@/components/insight/InsightChips';
import { Card } from '@/components/ui/Card';
import { useFmt } from '@/components/useFmt';
import type { ListingInsight } from '@/lib/views';

/** PRD FR-08: local demand, demand trend, aggregate nearby requirement. */
export function ListingInsightCard({ insight }: { insight: ListingInsight }) {
  const t = useTranslations('listings.detail');
  const fmt = useFmt();
  const p = insight.prediction;
  return (
    <Card title={t('insightTitle')}>
      <div className="space-y-3">
        <InsightChips demandLevel={p.demandLevel} trend={p.trend} priceDirection={p.priceDirection} confidence={p.confidence} />
        <p className="flex items-center gap-2 rounded-md bg-leaf-50 p-3 font-medium text-leaf-900">
          <Factory aria-hidden className="h-5 w-5 shrink-0" />
          {insight.nearbyDemandKg > 0
            ? t('nearbyDemand', { qty: fmt.qty(insight.nearbyDemandKg), buyers: insight.nearbyBuyers, km: insight.radiusKm })
            : t('noNearbyDemand', { km: insight.radiusKm })}
        </p>
        <ExplanationList items={p.explanation} />
        <Disclaimer modelVersion={p.modelVersion} asOf={fmt.date(p.asOf)} />
      </div>
    </Card>
  );
}
