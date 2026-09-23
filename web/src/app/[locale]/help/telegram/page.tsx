'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandMark } from '@/components/BrandMark';

// Página pública (sin AppShell, sin login) — la abre tanto quien gestiona
// la cuenta como cualquier miembro sin sesión, potencialmente compartida
// directo por chat/email. No hay botón genérico de "abrir el bot" acá: la
// vinculación necesita el enlace personal de cada miembro (con su member.id
// como start param, sección 0.13/0.14), que sale de su ficha en la app, no
// de esta página pública.
export default function TelegramHelpPage() {
  const t = useTranslations('TelegramHelp');
  const steps = t.raw('steps') as string[];

  return (
    <main className="page legal-page">
      <Link href="/">
        <BrandMark />
      </Link>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>

      <ol className="help-steps">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <p className="muted-link">{t('note')}</p>
    </main>
  );
}
