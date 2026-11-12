'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { CropOptions, DistrictOptions } from '@/components/forms/options';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { ErrorNote } from '@/components/ui/States';
import * as api from '@/lib/api';
import { addDays, todayIso } from '@/lib/dates';
import { useAction } from '@/lib/hooks';
import type { CropId, FarmerProfile, Grade, Listing, QtyUnit } from '@/lib/types';
import { validateNotPast, validatePrice, validateQuantity } from '@/lib/validation';
import { PhotoInput } from './PhotoInput';

interface Props {
  farmer: FarmerProfile;
  initialCrop?: CropId;
  onCreated: (listing: Listing) => void;
  onCancel: () => void;
}

export function ListingForm({ farmer, initialCrop, onCreated, onCancel }: Props) {
  const t = useTranslations('listings.form');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const today = todayIso();
  const [cropId, setCropId] = useState<CropId | ''>(initialCrop ?? '');
  const [variety, setVariety] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<QtyUnit>('q');
  const [readyDate, setReadyDate] = useState(addDays(today, 14));
  const [price, setPrice] = useState('');
  const [grade, setGrade] = useState<Grade | ''>('');
  const [moisture, setMoisture] = useState('');
  const [districtId, setDistrictId] = useState(farmer.districtId);
  const [location, setLocation] = useState(farmer.location);
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useAction(api.createListing);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const priceNum = price ? Number(price) : undefined;
    const found: Record<string, string | null> = {
      crop: cropId ? null : 'crop_required',
      quantity: validateQuantity(Number(quantity), unit),
      readyDate: validateNotPast(readyDate, today),
      price: validatePrice(priceNum, false),
    };
    const next = Object.fromEntries(Object.entries(found).filter((kv): kv is [string, string] => kv[1] !== null));
    setErrors(next);
    if (Object.keys(next).length || !cropId) return;
    const listing = await create.run({
      cropId,
      variety,
      quantity: Number(quantity),
      unit,
      readyDate,
      expectedPrice: priceNum,
      location,
      districtId,
      village: farmer.village,
      quality: { grade: grade || undefined, moisturePct: moisture ? Number(moisture) : undefined },
      photos,
    });
    if (listing) onCreated(listing);
  }

  const err = (k: string) => (errors[k] ? te(errors[k]) : null);
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('crop')} value={cropId} onChange={(e) => setCropId(e.target.value as CropId)} error={err('crop')}>
          <CropOptions placeholder={t('choose')} />
        </SelectField>
        <TextField label={`${t('variety')} (${tc('optional')})`} value={variety} onChange={(e) => setVariety(e.target.value)} maxLength={60} />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <TextField label={t('quantity')} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} error={err('quantity')} />
        <SelectField label={t('unit')} value={unit} onChange={(e) => setUnit(e.target.value as QtyUnit)}>
          <option value="q">{t('quintal')}</option>
          <option value="t">{t('tonne')}</option>
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('readyDate')} type="date" min={today} value={readyDate} onChange={(e) => setReadyDate(e.target.value)} error={err('readyDate')} />
        <TextField label={`${t('expectedPrice')} (${tc('optional')})`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} error={err('price')} />
        <SelectField label={`${t('grade')} (${tc('optional')})`} value={grade} onChange={(e) => setGrade(e.target.value as Grade | '')}>
          <option value="">{t('gradeUnknown')}</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </SelectField>
        <TextField label={`${t('moisture')} (${tc('optional')})`} inputMode="decimal" value={moisture} onChange={(e) => setMoisture(e.target.value)} />
      </div>
      <SelectField label={t('district')} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
        <DistrictOptions />
      </SelectField>
      <LocationPicker label={t('location')} value={location} onChange={setLocation} />
      <PhotoInput value={photos} onChange={setPhotos} />
      <ErrorNote code={create.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={create.pending}>
          {t('submit')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
