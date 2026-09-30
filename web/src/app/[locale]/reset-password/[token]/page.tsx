'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

// Página pública del link de "olvidé mi contraseña" (AuthService.resetPassword)
// — sin login, mismo criterio de token-como-credencial que /verify-email/[token].
// El match de las dos contraseñas se valida aquí, en el cliente — el backend
// solo recibe una (dto.password), no le importa si hubo confirmación.
export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const t = useTranslations('ResetPassword');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t('mismatch'));
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('invalidLink'));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
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

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <BrandMark />
        <div className="card">
          <h1>{t('title')}</h1>
          <form onSubmit={handleSubmit}>
            <label>
              {t('newPassword')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>
            <label>
              {t('confirmPassword')}
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
            </label>
            {error && (
              <p role="alert">
                <AlertCircle size={16} />
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}>
              {loading ? t('submitLoading') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
