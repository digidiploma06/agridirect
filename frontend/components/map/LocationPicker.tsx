'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LatLng } from '@/lib/types';

// Leaflet touches `window`, so it is loaded client-side and only on screens that need it.
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-[220px] animate-pulse rounded-md bg-gray-100" />,
});

interface Props {
  label: string;
  value: LatLng;
  onChange: (value: LatLng) => void;
}

export function LocationPicker({ label, value, onChange }: Props) {
  const t = useTranslations('common.location');
  const [gpsError, setGpsError] = useState(false);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!('geolocation' in navigator)) {
      setGpsError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setGpsError(false);
        onChange({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5 });
      },
      () => {
        setLocating(false);
        setGpsError(true);
      },
      { timeout: 10_000 },
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-800">{label}</legend>
      <p className="text-sm text-gray-500">{t('hint')}</p>
      <div className="overflow-hidden rounded-md border border-gray-300">
        <LeafletMap value={value} onChange={onChange} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm tabular-nums text-gray-600">
          {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
        </span>
        <Button variant="secondary" onClick={locate} loading={locating}>
          {t('gps')}
        </Button>
      </div>
      {gpsError && <p className="text-sm text-haldi-700">{t('gpsError')}</p>}
    </fieldset>
  );
}
