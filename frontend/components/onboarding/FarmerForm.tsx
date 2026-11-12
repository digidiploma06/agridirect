'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { DistrictOptions, EnumOptions, IRRIGATION, SOIL } from '@/components/forms/options';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { ErrorNote } from '@/components/ui/States';
import { getDistrict, type FarmerOnboarding } from '@/lib/api';
import { useAppLocale } from '@/lib/hooks';
import { LOCALE_LABELS } from '@/lib/i18n';
import { LOCALES, type Irrigation, type LatLng, type Locale, type SoilType } from '@/lib/types';
import { ConsentBlock, type Consent } from './ConsentBlock';

interface Props {
  onSubmit: (input: FarmerOnboarding) => void;
  pending: boolean;
  error: string | null;
}

export function FarmerForm({ onSubmit, pending, error }: Props) {
  const t = useTranslations('onboarding');
  const te = useTranslations('errors');
  const locale = useAppLocale();
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [districtId, setDistrictId] = useState('d-ahilyanagar');
  const [location, setLocation] = useState<LatLng>(getDistrict('d-ahilyanagar')!.centroid);
  const [land, setLand] = useState('');
  const [irrigation, setIrrigation] = useState<Irrigation>('well');
  const [soilType, setSoilType] = useState<SoilType>('unknown');
  const [language, setLanguage] = useState<Locale>(locale);
  const [consent, setConsent] = useState<Consent>({ account: false, marketing: false, age: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function changeDistrict(id: string) {
    setDistrictId(id);
    const d = getDistrict(id);
    if (d) setLocation(d.centroid);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'name_required';
    if (!village.trim()) next.village = 'village_required';
    if (!(Number(land) > 0)) next.land = 'land_area_invalid';
    if (!consent.account || !consent.age) next.consent = 'consent_required';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      role: 'farmer',
      name,
      village,
      districtId,
      location,
      landAreaAcres: Number(land),
      irrigation,
      soilType,
      language,
      consentAccount: consent.account,
      consentMarketing: consent.marketing,
      ageConfirmed: consent.age,
    });
  }

  const err = (k: string) => (errors[k] ? te(errors[k]) : null);
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" error={err('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('village')} value={village} onChange={(e) => setVillage(e.target.value)} error={err('village')} />
        <SelectField label={t('district')} value={districtId} onChange={(e) => changeDistrict(e.target.value)} hint={t('stateFixed')}>
          <DistrictOptions />
        </SelectField>
      </div>
      <LocationPicker label={t('farmLocation')} value={location} onChange={setLocation} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label={t('landArea')} inputMode="decimal" value={land} onChange={(e) => setLand(e.target.value)} error={err('land')} />
        <SelectField label={t('irrigation')} value={irrigation} onChange={(e) => setIrrigation(e.target.value as Irrigation)}>
          <EnumOptions ns="irrigation" values={IRRIGATION} />
        </SelectField>
        <SelectField label={t('soilType')} value={soilType} onChange={(e) => setSoilType(e.target.value as SoilType)}>
          <EnumOptions ns="soil" values={SOIL} />
        </SelectField>
      </div>
      <SelectField label={t('language')} value={language} onChange={(e) => setLanguage(e.target.value as Locale)}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </SelectField>
      <ConsentBlock value={consent} onChange={setConsent} />
      {errors.consent && <p className="text-sm text-red-700">{te(errors.consent)}</p>}
      <ErrorNote code={error} />
      <Button type="submit" className="w-full" loading={pending}>
        {t('submit')}
      </Button>
    </form>
  );
}
