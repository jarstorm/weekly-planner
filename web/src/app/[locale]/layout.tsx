import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// Serif editorial solo para el H1 del hero y los títulos de sección de la
// landing (.hero h1, .landing-section h2 en globals.css) — mezclar
// serif+sans en esos dos puntos es la señal de que hay una decisión de
// diseño detrás, no una plantilla. El resto del sitio sigue en Inter.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', weight: ['600', '700'] });

export const metadata: Metadata = {
  title: 'WeeklyFeedback',
  description: 'El resumen semanal que se escribe solo',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
