'use client';

import { Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';

const LOCALES = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <span className="locale-switcher">
      <Globe size={14} />
      {LOCALES.map((l, i) => (
        <span key={l.code}>
          {i > 0 && ' · '}
          {l.code === locale ? (
            <strong>{l.label}</strong>
          ) : (
            <Link href={pathname} locale={l.code}>
              {l.label}
            </Link>
          )}
        </span>
      ))}
    </span>
  );
}
