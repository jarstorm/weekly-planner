'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandMark } from '@/components/BrandMark';
import { useHomeHref } from '@/lib/useHomeHref';

export default function NotFound() {
  const t = useTranslations('NotFound');
  const homeHref = useHomeHref();

  return (
    <main className="page legal-page not-found-page">
      <BrandMark />
      <h1>{t('title')}</h1>
      <p>{t('message')}</p>
      <Link href={homeHref} className="btn btn-primary">
        {t('backToHome')}
      </Link>
    </main>
  );
}
