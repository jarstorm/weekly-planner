'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';

const LOCALES = [
  { code: 'es', flag: '🇪🇸', short: 'ES', label: 'Español' },
  { code: 'en', flag: '🇺🇸', short: 'EN', label: 'English' },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="locale-dropdown" ref={ref}>
      <button
        type="button"
        className="locale-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span role="img" aria-label={current.label} className="locale-flag">
          {current.flag}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="locale-dropdown-menu" role="listbox">
          {LOCALES.map((l) => {
            const isActive = l.code === locale;
            return (
              <Link
                key={l.code}
                href={pathname}
                locale={l.code}
                className={`locale-dropdown-item${isActive ? ' active' : ''}`}
                role="option"
                aria-selected={isActive}
                onClick={() => setOpen(false)}
              >
                <span role="img" aria-label={l.label} className="locale-flag">
                  {l.flag}
                </span>
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
