import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { TopBar } from '@/components/AppShell';

const SECTIONS = ['what', 'why', 'shared', 'retention', 'rights', 'grievance'] as const;

/** Plain-language privacy notice (DPDP; Security & Privacy v1.0 section 8). Draft pending legal review. */
export default async function PrivacyPage() {
  const t = await getTranslations('privacy');
  return (
    <div className="min-h-screen">
      <TopBar>
        <LanguageSwitcher />
      </TopBar>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {SECTIONS.map((s) => (
          <section key={s}>
            <h2 className="text-lg font-semibold">{t(`${s}.title`)}</h2>
            <p className="mt-1 text-gray-700">{t(`${s}.body`)}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
