'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, MailCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { BrandMark } from '@/components/BrandMark';

export default function RegisterPage() {
  const t = useTranslations('Register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register({ email, password, orgName });
      trackEvent('register');
      setRegistered(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <main className="auth-page">
        <div className="auth-wrap">
          <BrandMark />
          <div className="card" style={{ textAlign: 'center' }}>
            <MailCheck size={32} color="var(--color-brand)" />
            <h1>{t('checkEmailTitle')}</h1>
            <p>{t('checkEmailBody', { email })}</p>
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
              {t('orgName')}
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            </label>
            <label>
              {t('email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              {t('password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
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
          <p>
            {t('haveAccount')} <Link href="/login">{t('loginLink')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
