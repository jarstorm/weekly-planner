'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandMark } from '@/components/BrandMark';
import { api } from '@/lib/api';

// Página pública (sin AppShell, sin login) — la abre tanto quien gestiona
// la cuenta como cualquier miembro sin sesión, enlazada desde las
// pantallas de alta/edición de miembro (sección 0.13/0.14 del doc
// técnico) y potencialmente compartida directo por chat/email.
export default function TelegramHelpPage() {
  const t = useTranslations('TelegramHelp');
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTelegramBotUsername()
      .then((r) => setBotUsername(r.username))
      .catch(() => setBotUsername(null));
  }, []);

  const steps = t.raw('steps') as string[];

  return (
    <main className="page legal-page">
      <Link href="/">
        <BrandMark />
      </Link>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>

      {botUsername && (
        <p>
          <a className="btn btn-primary" href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
            {t('openBot', { bot: `@${botUsername}` })}
          </a>
        </p>
      )}

      <ol className="help-steps">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <p className="muted-link">{t('note')}</p>
    </main>
  );
}
