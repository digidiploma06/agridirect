'use client';

import { Building2, Tractor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { TopBar } from '@/components/AppShell';
import { CompanyForm } from '@/components/onboarding/CompanyForm';
import { FarmerForm } from '@/components/onboarding/FarmerForm';
import { Card } from '@/components/ui/Card';
import * as api from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { setLocaleCookie } from '@/lib/i18n';
import { HOME_BY_ROLE, useSession } from '@/lib/session';
import type { Party } from '@/lib/types';

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { session, ready, refresh } = useSession();
  const [role, setRole] = useState<Party | null>(null);
  const save = useAction(api.completeOnboarding);

  // Already signed in: nothing to onboard.
  useEffect(() => {
    if (ready && session) router.replace(HOME_BY_ROLE[session.user.role]);
  }, [ready, session, router]);

  async function submit(input: api.FarmerOnboarding | api.CompanyOnboarding) {
    const user = await save.run(input);
    if (!user) return;
    setLocaleCookie(user.language);
    await refresh();
    router.replace(HOME_BY_ROLE[user.role]);
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <TopBar>
        <LanguageSwitcher />
      </TopBar>
      <main className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="mb-1 text-2xl font-bold">{t('title')}</h1>
        <p className="mb-4 text-gray-600">{t('subtitle')}</p>

        {role === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { r: 'farmer', icon: Tractor },
                { r: 'company', icon: Building2 },
              ] as const
            ).map(({ r, icon: Icon }) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-leaf-200 bg-white shadow-card p-5 text-left hover:border-leaf-700 hover:bg-leaf-50"
              >
                <Icon aria-hidden className="h-7 w-7 text-leaf-700" strokeWidth={1.5} />
                <span className="text-lg font-semibold">{t(`roles.${r}.title`)}</span>
                <span className="text-gray-600">{t(`roles.${r}.body`)}</span>
              </button>
            ))}
          </div>
        ) : (
          <Card
            title={t(`roles.${role}.title`)}
            action={
              <button type="button" onClick={() => setRole(null)} className="min-h-touch px-2 font-medium text-leaf-800 underline">
                {t('changeRole')}
              </button>
            }
          >
            {role === 'farmer' ? (
              <FarmerForm onSubmit={submit} pending={save.pending} error={save.error} />
            ) : (
              <CompanyForm onSubmit={submit} pending={save.pending} error={save.error} />
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
