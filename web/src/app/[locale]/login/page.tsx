'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { BrandMark } from '@/components/BrandMark';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('Login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login({ email, password });
      trackEvent('login');
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <BrandMark />
        <div className="card">
          <h1>{t('title')}</h1>
          <form onSubmit={handleSubmit}>
            <label>
              {t('email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              {t('password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
            <Link href="/forgot-password">{t('forgotPassword')}</Link>
          </p>
          <p>
            {t('noAccount')} <Link href="/register">{t('registerLink')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
