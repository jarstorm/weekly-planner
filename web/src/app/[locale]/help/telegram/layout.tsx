import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageAlternates } from '@/lib/seo';

// page.tsx es 'use client' — ver login/layout.tsx.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'TelegramHelp' });
  return {
    title: t('title'),
    description: t('intro'),
    alternates: pageAlternates('/help/telegram', locale),
  };
}

export default function TelegramHelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
