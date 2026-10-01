import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageAlternates } from '@/lib/seo';

// page.tsx es 'use client' — ver login/layout.tsx.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Register' });
  return {
    title: t('title'),
    description:
      locale === 'en'
        ? 'Create your WeeklyFeedback account and set up your team in minutes.'
        : 'Crea tu cuenta de WeeklyFeedback y da de alta a tu equipo en minutos.',
    alternates: pageAlternates('/register', locale),
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
