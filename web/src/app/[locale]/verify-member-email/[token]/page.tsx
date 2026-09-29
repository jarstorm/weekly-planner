'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

// Página pública del link de verificación de email de un MIEMBRO de equipo
// (MemberVerifyService.verify) — distinto de /verify-email/[token], que es
// para el dueño de la cuenta. Un miembro nunca tiene login, así que no hay
// nada a lo que enlazar después de confirmar, solo el aviso.
export default function VerifyMemberEmailPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const t = useTranslations('VerifyMemberEmail');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .verifyMemberEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t('invalidLink'));
        setStatus('error');
      });
  }, [token, t]);

  if (status === 'loading') {
    return (
      <main className="auth-page">
        <div className="auth-wrap">
          <BrandMark />
          <p>{t('loading')}</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="auth-page">
        <div className="auth-wrap">
          <BrandMark />
          <p role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <BrandMark />
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle2 size={32} color="var(--color-brand)" />
          <p>{t('success')}</p>
        </div>
      </div>
    </main>
  );
}
