'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { CropOptions, DistrictOptions } from '@/components/forms/options';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { ErrorNote } from '@/components/ui/States';
import * as api from '@/lib/api';
import { addDays, todayIso } from '@/lib/dates';
import { useAction } from '@/lib/hooks';
import type { CompanyProfile, CropId, Grade, QtyUnit, Requirement } from '@/lib/types';
import { validateNotPast, validatePriceRange, validateQuantity } from '@/lib/validation';

interface Props {
  company: CompanyProfile;
  disabled: boolean;
  onCreated: (r: Requirement) => void;
}

export function RequirementForm({ company, disabled, onCreated }: Props) {
  const t = useTranslations('requirement.form');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const today = todayIso();
  const [cropId, setCropId] = useState<CropId | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<QtyUnit>('t');
  const [requiredBy, setRequiredBy] = useState(addDays(today, 30));
  const [districtId, setDistrictId] = useState(company.districtId);
  const [location, setLocation] = useState(company.location);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [minGrade, setMinGrade] = useState<Grade | ''>('');
  const [maxMoisture, setMaxMoisture] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useAction(api.createRequirement);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string | null> = {
      crop: cropId ? null : 'crop_required',
      quantity: validateQuantity(Number(quantity), unit),
      requiredBy: validateNotPast(requiredBy, today),
      price: validatePriceRange(Number(priceMin), Number(priceMax)),
    };
    const next = Object.fromEntries(Object.entries(found).filter((kv): kv is [string, string] => kv[1] !== null));
    setErrors(next);
    if (Object.keys(next).length || !cropId) return;
    const r = await create.run({
      cropId,
      quantity: Number(quantity),
      unit,
      requiredBy,
      deliveryLocation: location,
      districtId,
      priceMin: Number(priceMin),
      priceMax: Number(priceMax),
      qualitySpec: { minGrade: minGrade || undefined, maxMoisturePct: maxMoisture ? Number(maxMoisture) : undefined },
      notes: notes || undefined,
    });
    if (r) onCreated(r);
  }

  const err = (k: string) => (errors[k] ? te(errors[k]) : null);
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        <SelectField label={t('crop')} value={cropId} onChange={(e) => setCropId(e.target.value as CropId)} error={err('crop')}>
          <CropOptions placeholder={t('choose')} />
        </SelectField>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <TextField label={t('quantity')} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} error={err('quantity')} />
          <SelectField label={t('unit')} value={unit} onChange={(e) => setUnit(e.target.value as QtyUnit)}>
            <option value="q">{tc('units.q')}</option>
            <option value="t">{tc('units.t')}</option>
          </SelectField>
        </div>
        <TextField label={t('requiredBy')} type="date" min={today} value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} error={err('requiredBy')} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label={t('priceMin')} inputMode="numeric" value={priceMin} onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, ''))} error={err('price')} />
          <TextField label={t('priceMax')} inputMode="numeric" value={priceMax} onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectField label={`${t('minGrade')} (${tc('optional')})`} value={minGrade} onChange={(e) => setMinGrade(e.target.value as Grade | '')}>
            <option value="">{t('any')}</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </SelectField>
          <TextField label={`${t('maxMoisture')} (${tc('optional')})`} inputMode="decimal" value={maxMoisture} onChange={(e) => setMaxMoisture(e.target.value)} />
        </div>
        <SelectField label={t('district')} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
          <DistrictOptions />
        </SelectField>
        <LocationPicker label={t('deliveryLocation')} value={location} onChange={setLocation} />
        <TextAreaField label={`${t('notes')} (${tc('optional')})`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </fieldset>
      <ErrorNote code={create.error} />
      <Button type="submit" loading={create.pending} disabled={disabled}>
        {t('submit')}
      </Button>
    </form>
  );
}
