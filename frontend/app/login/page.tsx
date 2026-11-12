'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { TopBar } from '@/components/AppShell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { ErrorNote } from '@/components/ui/States';
import * as api from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { HOME_BY_ROLE, useSession } from '@/lib/session';
import { validateOtp, validatePhone } from '@/lib/validation';

export default function LoginPage() {
  const t = useTranslations('login');
  const te = useTranslations('errors');
  const router = useRouter();
  const { refresh } = useSession();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const send = useAction(api.requestOtp);
  const verify = useAction(api.verifyOtp);

  async function sendOtp(raw: string) {
    const err = validatePhone(raw);
    setFieldError(err);
    if (err) return;
    const res = await send.run(raw);
    if (res) {
      setSentTo(res.phone);
      setCode('');
      setDevOtp(res.devOtp ?? null);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    const err = validateOtp(code);
    setFieldError(err);
    if (err || !sentTo) return;
    const user = await verify.run(sentTo, code);
    if (user === undefined) return; // error shown below
    if (user === null) {
      router.push('/onboarding');
      return;
    }
    await refresh();
    router.push(HOME_BY_ROLE[user.role]);
  }

  return (
    <div className="min-h-screen">
      <TopBar>
        <LanguageSwitcher />
      </TopBar>
      <main className="mx-auto max-w-sm px-4 py-10">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mb-6 mt-1 text-gray-600">{t('subtitle')}</p>
        <div className="rounded-2xl border border-leaf-200 bg-white shadow-card p-5">
          {!sentTo ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendOtp(phone);
              }}
              className="space-y-4"
              noValidate
            >
              <TextField
                label={t('phoneLabel')}
                hint={t('phoneHint')}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={fieldError && te(fieldError)}
                autoFocus
              />
              <ErrorNote code={send.error} />
              <Button type="submit" className="w-full" loading={send.pending}>
                {t('sendOtp')}
              </Button>
            </form>
          ) : (
            <form onSubmit={onVerify} className="space-y-4" noValidate>
              <p className="text-gray-700">{t('sentTo', { phone: sentTo })}</p>
              {devOtp && (
                <p className="rounded-md border border-haldi-400 bg-haldi-50 p-2 text-sm text-haldi-700">
                  {t('devOtp')} <strong className="font-mono text-base tracking-widest">{devOtp}</strong>
                </p>
              )}
              <TextField
                label={t('otpLabel')}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                error={fieldError && te(fieldError)}
                className="text-center font-semibold tracking-[0.5em]"
                autoFocus
              />
              <ErrorNote code={verify.error ?? send.error} />
              <Button type="submit" className="w-full" loading={verify.pending}>
                {t('verify')}
              </Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="min-h-touch text-leaf-800 underline-offset-4 hover:underline" onClick={() => setSentTo(null)}>
                  {t('changeNumber')}
                </button>
                <button type="button" className="min-h-touch text-leaf-800 underline-offset-4 hover:underline" onClick={() => void sendOtp(sentTo)}>
                  {t('resend')}
                </button>
              </div>
            </form>
          )}
        </div>
        <p className="mt-6 text-sm text-gray-600">
          {t('terms')}{' '}
          <Link href="/privacy" className="text-leaf-800 underline underline-offset-4">
            {t('privacy')}
          </Link>
        </p>
      </main>
    </div>
  );
}
