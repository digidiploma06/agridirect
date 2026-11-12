import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter, Mukta } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/ServiceWorker';
import { SessionProvider } from '@/lib/session';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
// Italic serif used only for the accent words in large headlines.
const serif = Instrument_Serif({ subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: '400', style: ['normal', 'italic'] });
// Mukta (Ek Type) reads well at small sizes on low-end Android screens.
const deva = Mukta({ subsets: ['devanagari'], variable: '--font-deva', display: 'swap', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'AgriDirect',
  description: 'Crop demand prediction and a direct farmer-to-company marketplace.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#f3eee3',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable} ${deva.variable}`}>
      <body className="min-h-screen bg-soil-50 font-sans text-leaf-800 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
          <SessionProvider>{children}</SessionProvider>
        </NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
