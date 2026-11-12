'use client';

import { Camera, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { MAX_PHOTOS, PHOTO_TYPES, validatePhoto } from '@/lib/validation';

const MAX_EDGE_PX = 640;

/**
 * Re-encodes the image through a canvas. This drops all EXIF metadata,
 * including GPS (PRD section 9), and keeps the session-storage copy small.
 */
async function reencode(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.75);
}

export function PhotoInput({ value, onChange }: { value: string[]; onChange: (photos: string[]) => void }) {
  const t = useTranslations('listings.form');
  const te = useTranslations('errors');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX_PHOTOS - value.length;
    const picked = Array.from(files);
    if (picked.length > room) setError('photo_count');
    setBusy(true);
    const out: string[] = [];
    for (const file of picked.slice(0, room)) {
      const err = validatePhoto(file);
      if (err) {
        setError(err);
        continue;
      }
      out.push(await reencode(file));
    }
    setBusy(false);
    onChange([...value, ...out]);
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-gray-800">{t('photos')}</span>
      <div className="flex flex-wrap gap-2">
        {value.map((src, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={src} alt="" className="h-20 w-20 rounded-md object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white"
            >
              <X aria-hidden className="h-4 w-4" />
              <span className="sr-only">{t('removePhoto')}</span>
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-leaf-500">
            <Camera aria-hidden className="h-6 w-6" />
            {busy ? '…' : t('addPhoto')}
            <input type="file" accept={PHOTO_TYPES.join(',')} multiple className="sr-only" onChange={(e) => void add(e.target.files)} />
          </label>
        )}
      </div>
      <p className="text-sm text-gray-500">{t('photosHint')}</p>
      {error && <p className="text-sm text-red-700">{te(error)}</p>}
    </div>
  );
}
