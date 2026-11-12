import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { TopBar } from '@/components/AppShell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ButtonLink } from '@/components/ui/Button';
import { getPriceSnapshot } from '@/lib/api';
import { formatNumber, formatRupees } from '@/lib/format';
import { isLocale } from '@/lib/i18n';

const STEPS = ['advice', 'list', 'deal'] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tCrop = await getTranslations('crops');
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'en';
  const prices = await getPriceSnapshot();

  // Headline: first sentence in the sans face, the rest as the italic serif accent.
  const title = t('title');
  const split = /^(.*?[.।!?])\s+(.+)$/.exec(title);
  const lead = split?.[1] ?? title;
  const accent = split?.[2];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login" className="flex h-10 items-center rounded-full bg-leaf-800 px-4 text-[15px] font-semibold text-white hover:bg-leaf-700">
            {t('login')}
          </Link>
        </div>
      </TopBar>

      <main className="flex-1">
        <section>
          <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 sm:px-6 lg:px-10 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-leaf-300 bg-white px-3 py-1 text-sm font-medium text-leaf-600">
                <span aria-hidden className="h-2 w-2 rounded-full bg-haldi-500" />
                {t('badge')}
              </p>
              <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.05] text-leaf-800 md:text-[3.6rem]">
                {lead}
                {accent && (
                  <>
                    {' '}
                    <span className="font-serif font-normal italic underline decoration-haldi-500 decoration-[3px] underline-offset-[6px]">{accent}</span>
                  </>
                )}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-leaf-600">{t('subtitle')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/login">{t('ctaFarmer')} →</ButtonLink>
                <ButtonLink href="/login" variant="secondary">
                  {t('ctaCompany')}
                </ButtonLink>
              </div>
            </div>

            <div className="relative self-center">
              {/* Offset orange block behind the card. */}
              <div aria-hidden className="absolute -bottom-4 -right-4 left-8 top-8 rounded-3xl bg-haldi-500" />
              <div className="relative overflow-hidden rounded-3xl border border-leaf-200 bg-white shadow-card">
                <div className="flex items-center justify-between px-5 pb-3 pt-5">
                  <div>
                    <h2 className="text-lg font-semibold text-leaf-800">{t('priceTitle')}</h2>
                    <span className="text-sm text-leaf-500">{t('perQuintal')}</span>
                  </div>
                  <span className="rounded-full bg-leaf-800 px-3 py-1 text-xs font-medium text-white">{t('live')}</span>
                </div>
                <table className="w-full text-[15px]">
                  <thead className="sr-only">
                    <tr>
                      <th>{t('colCrop')}</th>
                      <th>{t('colMandi')}</th>
                      <th>{t('colPrice')}</th>
                      <th>{t('colChange')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p) => (
                      <tr key={p.cropId} className="border-t border-leaf-100">
                        <td className="py-3 pl-5 font-semibold text-leaf-800">{tCrop(p.cropId)}</td>
                        <td className="py-3 text-leaf-500">{p.mandiName}</td>
                        <td className="py-3 text-right font-semibold tabular-nums text-leaf-800">{formatRupees(p.modalPrice, locale)}</td>
                        <td className="py-3 pl-3 pr-5 text-right">
                          <span className={`inline-block min-w-[4.5rem] rounded-full px-2 py-0.5 text-center text-sm font-medium tabular-nums ${p.change4w >= 0 ? 'bg-leaf-800 text-white' : 'bg-haldi-50 text-haldi-700'}`}>
                            {p.change4w >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(p.change4w * 100), locale, 1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-leaf-100 bg-leaf-50 px-5 py-3 text-xs text-leaf-500">{t('priceNote')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 pb-14 pt-4">
          <h2 className="mb-6 text-[1.75rem] font-semibold text-leaf-800">{t('howTitle')}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((key, i) => (
              <li key={key} className="rounded-2xl border border-leaf-200 bg-white p-6 shadow-card">
                <span className="font-serif text-4xl italic text-haldi-500">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold text-leaf-800">{t(`steps.${key}.title`)}</h3>
                <p className="mt-1.5 leading-relaxed text-leaf-600">{t(`steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-4 px-4 sm:px-6 lg:px-10 pb-16 md:grid-cols-2">
          {(['farmers', 'buyers'] as const).map((who) => {
            const dark = who === 'farmers';
            return (
              <div key={who} className={`rounded-3xl p-7 ${dark ? 'bg-leaf-800 text-white' : 'border border-leaf-200 bg-white text-leaf-800 shadow-card'}`}>
                <h2 className="text-xl font-semibold">{t(`${who}.title`)}</h2>
                <ul className={`mt-4 space-y-3 ${dark ? 'text-leaf-100' : 'text-leaf-600'}`}>
                  {(['a', 'b', 'c'] as const).map((k) => (
                    <li key={k} className="flex gap-3">
                      <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-haldi-500" />
                      {t(`${who}.${k}`)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="bg-leaf-800 text-leaf-200">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 py-6 text-sm">
          <span>{t('footer')}</span>
          <Link href="/privacy" className="min-h-touch py-3 text-white underline decoration-haldi-500 underline-offset-4">
            {t('privacy')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
