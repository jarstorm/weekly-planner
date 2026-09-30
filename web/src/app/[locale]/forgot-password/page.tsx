'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

// Mismo mensaje se muestre o no la cuenta (AuthService.requestPasswordReset
// ya no filtra nada por su lado) — aquí tampoco: no hay un estado de error
// distinto para "ese email no existe", solo loading -> sent.
export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPassword');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.requestPasswordReset(email);
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <BrandMark />
        <div className="card">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={32} color="var(--color-brand)" />
              <p>{t('sent')}</p>
              <p>
                <Link href="/login">{t('loginLink')}</Link>
              </p>
            </div>
          ) : (
            <>
              <h1>{t('title')}</h1>
              <p>{t('intro')}</p>
              <form onSubmit={handleSubmit}>
                <label>
                  {t('email')}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <button type="submit" disabled={loading}>
                  {loading ? t('submitLoading') : t('submit')}
                </button>
              </form>
              <p>
                <Link href="/login">{t('loginLink')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
