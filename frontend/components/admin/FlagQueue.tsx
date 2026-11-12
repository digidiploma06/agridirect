'use client';

import { useTranslations } from 'next-intl';
import { ListingCard } from '@/components/listings/ListingCard';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/States';
import { useFmt } from '@/components/useFmt';
import * as api from '@/lib/api';
import { useAction } from '@/lib/hooks';
import type { FlagView } from '@/lib/views';

/** PRD 7.3: flag queue with dismiss / hide listing / block user. */
export function FlagQueue({ flags, onChange }: { flags: FlagView[]; onChange: () => void }) {
  const t = useTranslations('admin.flags');
  const fmt = useFmt();
  const resolve = useAction(api.resolveFlag);

  async function act(id: string, action: 'dismiss' | 'hide' | 'block') {
    await resolve.run(id, action);
    onChange();
  }

  if (flags.length === 0) return <p className="text-gray-600">{t('empty')}</p>;
  return (
    <div className="space-y-3">
      <ErrorNote code={resolve.error} />
      {flags.map((f) => (
        <div key={f.id} className="space-y-2">
          <p className="text-gray-800">
            <span className="font-semibold">{t('reason')}:</span> {f.reason}
            <span className="text-sm text-gray-500"> ({f.reporterName}, {fmt.dateTime(f.createdAt)})</span>
          </p>
          <ListingCard
            listing={f.listing}
            footer={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => act(f.id, 'dismiss')}>
                  {t('dismiss')}
                </Button>
                <Button variant="secondary" onClick={() => act(f.id, 'hide')}>
                  {t('hide')}
                </Button>
                <Button variant="danger" onClick={() => act(f.id, 'block')}>
                  {t('block')}
                </Button>
              </div>
            }
          />
        </div>
      ))}
    </div>
  );
}
