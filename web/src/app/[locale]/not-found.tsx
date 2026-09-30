'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandMark } from '@/components/BrandMark';
import { api } from '@/lib/api';

export default function NotFound() {
  const t = useTranslations('NotFound');
  // Sin sesión no sabemos si hay una cuenta detrás — el logo/CTA llevan a
  // la portada por defecto y solo saltan al dashboard si /auth/me confirma
  // que hay cookie de sesión válida.
  const [homeHref, setHomeHref] = useState<'/' | '/app'>('/');

  useEffect(() => {
    api.me().then(
      () => setHomeHref('/app'),
      () => {},
    );
  }, []);

  return (
    <main className="page legal-page not-found-page">
      <Link href={homeHref}>
        <BrandMark />
      </Link>
      <h1>{t('title')}</h1>
      <p>{t('message')}</p>
      <Link href={homeHref} className="btn btn-primary">
        {t('backToHome')}
      </Link>
    </main>
  );
}
