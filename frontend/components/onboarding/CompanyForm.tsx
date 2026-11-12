'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { COMPANY_TYPES, DistrictOptions, EnumOptions, useDistrictName } from '@/components/forms/options';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField } from '@/components/ui/Field';
import { ErrorNote, Notice } from '@/components/ui/States';
import { DISTRICTS, getDistrict, type CompanyOnboarding } from '@/lib/api';
import { useAppLocale } from '@/lib/hooks';
import type { CompanyType, LatLng } from '@/lib/types';
import { validateGstin } from '@/lib/validation';
import { ConsentBlock, type Consent } from './ConsentBlock';

interface Props {
  onSubmit: (input: CompanyOnboarding) => void;
  pending: boolean;
  error: string | null;
}

export function CompanyForm({ onSubmit, pending, error }: Props) {
  const t = useTranslations('onboarding');
  const te = useTranslations('errors');
  const locale = useAppLocale();
  const districtName = useDistrictName();
  const [companyName, setCompanyName] = useState('');
  const [type, setType] = useState<CompanyType>('processor');
  const [gstin, setGstin] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [districtId, setDistrictId] = useState('d-pune');
  const [location, setLocation] = useState<LatLng>(getDistrict('d-pune')!.centroid);
  const [operating, setOperating] = useState<string[]>(['d-pune']);
  const [consent, setConsent] = useState<Consent>({ account: false, marketing: false, age: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!companyName.trim()) next.companyName = 'name_required';
    if (!contact.trim()) next.contact = 'name_required';
    const g = validateGstin(gstin);
    if (g) next.gstin = g;
    if (operating.length === 0) next.operating = 'district_required';
    if (!consent.account || !consent.age) next.consent = 'consent_required';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      role: 'company',
      name: contact,
      companyName,
      type,
      gstin,
      email,
      districtId,
      location,
      operatingDistricts: operating,
      language: locale,
      consentAccount: consent.account,
      consentMarketing: consent.marketing,
      ageConfirmed: consent.age,
    });
  }

  const err = (k: string) => (errors[k] ? te(errors[k]) : null);
  const toggle = (id: string, on: boolean) => setOperating((o) => (on ? [...o, id] : o.filter((x) => x !== id)));

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Notice tone="info">{t('companyPendingNote')}</Notice>
      <TextField label={t('companyName')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" error={err('companyName')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('companyType')} value={type} onChange={(e) => setType(e.target.value as CompanyType)}>
          <EnumOptions ns="companyType" values={COMPANY_TYPES} />
        </SelectField>
        <TextField
          label={t('gstin')}
          hint={t('gstinHint')}
          value={gstin}
          maxLength={15}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          error={err('gstin')}
          className="font-mono uppercase"
        />
        <TextField label={t('contactPerson')} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="name" error={err('contact')} />
        <TextField label={`${t('email')} (${t('optional')})`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <SelectField
        label={t('unitDistrict')}
        value={districtId}
        onChange={(e) => {
          setDistrictId(e.target.value);
          const d = getDistrict(e.target.value);
          if (d) setLocation(d.centroid);
        }}
      >
        <DistrictOptions />
      </SelectField>
      <LocationPicker label={t('unitLocation')} value={location} onChange={setLocation} />
      <fieldset>
        <legend className="text-sm font-medium text-gray-800">{t('operatingDistricts')}</legend>
        <div className="grid grid-cols-2 gap-x-4">
          {DISTRICTS.map((d) => (
            <Checkbox key={d.id} label={districtName(d.id)} checked={operating.includes(d.id)} onChange={(on) => toggle(d.id, on)} />
          ))}
        </div>
        {errors.operating && <p className="text-sm text-red-700">{te(errors.operating)}</p>}
      </fieldset>
      <ConsentBlock value={consent} onChange={setConsent} />
      {errors.consent && <p className="text-sm text-red-700">{te(errors.consent)}</p>}
      <ErrorNote code={error} />
      <Button type="submit" className="w-full" loading={pending}>
        {t('submitCompany')}
      </Button>
    </form>
  );
}
