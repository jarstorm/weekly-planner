'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

// Página pública del link de verificación de email (AuthService.verifyEmail)
// — sin login, sin AppShell, mismo criterio de token-como-credencial que
// /checkin/[token] y /survey/[token]. Idempotente a propósito (ver
// AuthService.verifyEmail): hacer clic dos veces no es un error.
export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const t = useTranslations('VerifyEmail');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .verifyEmail(token)
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
          <p>
            <Link href="/login">{t('loginLink')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
