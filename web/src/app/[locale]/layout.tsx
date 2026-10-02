import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AnalyticsPageview } from '@/components/AnalyticsPageview';
import { GoatCounterScript } from '@/components/GoatCounterScript';
import { SITE_URL, ogLocale } from '@/lib/seo';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// Serif editorial solo para el H1 del hero y los títulos de sección de la
// landing (.hero h1, .landing-section h2 en globals.css) — mezclar
// serif+sans en esos dos puntos es la señal de que hay una decisión de
// diseño detrás, no una plantilla. El resto del sitio sigue en Inter.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', weight: ['600', '700'] });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const description =
    locale === 'en' ? 'The weekly report your team writes itself' : 'El resumen semanal que se escribe solo';

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: 'WeeklyFeedback', template: '%s · WeeklyFeedback' },
    description,
    icons: { icon: '/icon.svg' },
    openGraph: {
      siteName: 'WeeklyFeedback',
      type: 'website',
      description,
      ...ogLocale(locale),
    },
    twitter: { card: 'summary_large_image' },
  };
}

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
        {/* GoatCounter self-hosted (sin cookies, sin banner GDPR necesario)
            — solo se carga si NEXT_PUBLIC_GOATCOUNTER_URL está seteada
            (producción); en local dev queda sin analytics. no_onload
            desactiva su conteo automático del primer load: en una SPA de
            Next.js las navegaciones siguientes son client-side y ese
            conteo nunca se repetiría, así que AnalyticsPageview es la
            única fuente de pageviews (primero y siguientes). */}
        {process.env.NEXT_PUBLIC_GOATCOUNTER_URL && (
          <GoatCounterScript url={process.env.NEXT_PUBLIC_GOATCOUNTER_URL} />
        )}
        <AnalyticsPageview />
      </body>
    </html>
  );
}
