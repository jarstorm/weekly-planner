'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

export default function RegisterPage() {
  const t = useTranslations('Register');
  const tBilling = useTranslations('Billing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState<'equipo' | 'organizacion'>('equipo');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register({ email, password, orgName });
      setRedirecting(true);
      const { url } = await api.createCheckoutSession(plan);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
      setRedirecting(false);
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
            <div>
              <span style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-neutral-700)' }}>
                {t('selectPlan')}
              </span>
              <div className="plan-picker">
                <label className="plan-picker-option">
                  <input
                    type="radio"
                    name="plan"
                    value="equipo"
                    checked={plan === 'equipo'}
                    onChange={() => setPlan('equipo')}
                  />
                  <span className="plan-picker-option-top">
                    <span>{tBilling('planEquipo')}</span>
                    <span className="plan-picker-option-price">{tBilling('perMonth', { price: 49 })}</span>
                  </span>
                  <span className="plan-picker-option-desc">{tBilling('teamPlanDesc')}</span>
                </label>
                <label className="plan-picker-option">
                  <input
                    type="radio"
                    name="plan"
                    value="organizacion"
                    checked={plan === 'organizacion'}
                    onChange={() => setPlan('organizacion')}
                  />
                  <span className="plan-picker-option-top">
                    <span>{tBilling('planOrganizacion')}</span>
                    <span className="plan-picker-option-price">{tBilling('perMonth', { price: 149 })}</span>
                  </span>
                  <span className="plan-picker-option-desc">{tBilling('orgPlanDesc')}</span>
                </label>
              </div>
              <p className="muted-link price-note">{tBilling('priceNote')}</p>
            </div>
            {error && (
              <p role="alert">
                <AlertCircle size={16} />
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}>
              {redirecting ? tBilling('redirecting') : loading ? t('submitLoading') : t('submit')}
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
