import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/BrandMark';
import { pageAlternates } from '@/lib/seo';

interface LegalSection {
  heading: string;
  body: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal' });
  return {
    title: t('termsTitle'),
    description: locale === 'en' ? 'Terms of service for WeeklyFeedback.' : 'Términos de servicio de WeeklyFeedback.',
    alternates: pageAlternates('/legal/terms', locale),
  };
}

export default function TermsPage() {
  const t = useTranslations('Legal');
  const sections = t.raw('termsSections') as LegalSection[];

  return (
    <main className="page legal-page">
      <BrandMark />
      <h1>{t('termsTitle')}</h1>
      <p className="muted-link">{t('lastUpdated')}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </main>
  );
}
