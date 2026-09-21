'use client';

import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';

const LOCALES = [
  { code: 'es', flag: '🇪🇸', short: 'ES', label: 'Español' },
  { code: 'en', flag: '🇺🇸', short: 'EN', label: 'English' },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <span className="locale-switcher">
      {LOCALES.map((l, i) => {
        const isActive = l.code === locale;
        const content = (
          <>
            <span role="img" aria-label={l.label}>
              {l.flag}
            </span>{' '}
            {l.short}
          </>
        );
        return (
          <span key={l.code}>
            {i > 0 && ' · '}
            {isActive ? (
              <strong title={l.label}>
                {content}
              </strong>
            ) : (
              <Link href={pathname} locale={l.code} title={l.label}>
                {content}
              </Link>
            )}
          </span>
        );
      })}
    </span>
  );
}
