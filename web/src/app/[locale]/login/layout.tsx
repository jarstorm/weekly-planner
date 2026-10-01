import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageAlternates } from '@/lib/seo';

// page.tsx es 'use client' (formulario con estado) — un componente cliente
// no puede exportar generateMetadata, de ahí este layout server aparte.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Login' });
  return {
    title: t('title'),
    description: locale === 'en' ? 'Sign in to your WeeklyFeedback dashboard.' : 'Entra en tu panel de WeeklyFeedback.',
    alternates: pageAlternates('/login', locale),
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
