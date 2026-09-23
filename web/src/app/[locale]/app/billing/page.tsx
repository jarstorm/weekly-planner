'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, BillingStatus } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { BillingSkeleton } from '@/components/Skeleton';

// Checkout hospedado por Stripe (Stripe Checkout), no Elements a medida —
// para el MVP no hace falta un formulario de tarjeta propio, y Checkout
// ya trae impuestos/facturas/reintentos de pago resueltos.
export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('Billing');
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => api.billingStatus())
      .then(setStatus)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push('/login');
        } else {
          setError(t('loadError'));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function subscribe(plan: 'equipo' | 'organizacion') {
    setActionError(null);
    setPendingPlan(plan);
    try {
      const { url } = await api.createCheckoutSession(plan);
      window.location.href = url;
    } catch {
      setActionError(t('checkoutError'));
      setPendingPlan(null);
    }
  }

  async function openPortal() {
    setActionError(null);
    try {
      const { url } = await api.createPortalSession();
      window.location.href = url;
    } catch {
      setActionError(t('portalError'));
    }
  }

  async function applyPromoCode(e: React.FormEvent) {
    e.preventDefault();
    setPromoStatus('loading');
    setPromoError(null);
    setPromoSuccess(false);
    try {
      await api.applyPromoCode(promoCode.trim());
      setPromoStatus('idle');
      setPromoSuccess(true);
      setPromoCode('');
    } catch (err) {
      setPromoStatus('error');
      setPromoError(err instanceof ApiError ? err.message : t('promoCodeError'));
    }
  }

  const checkoutResult = searchParams?.get('checkout');

  if (error) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (status === null) {
    return (
      <AppShell>
        <BillingSkeleton />
      </AppShell>
    );
  }

  const statusLabel =
    status.status === 'active' ? t('statusActive') : status.status === 'canceled' ? t('statusCanceled') : t('statusTrial');
  const planLabel =
    status.plan === 'equipo' ? t('planEquipo') : status.plan === 'organizacion' ? t('planOrganizacion') : t('planCustom');

  return (
    <AppShell>
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{t('title')}</h1>
      </div>

      {checkoutResult === 'success' && <div className="card">{t('checkoutSuccess')}</div>}
      {checkoutResult === 'cancel' && <div className="card">{t('checkoutCancel')}</div>}
      {actionError && <p role="alert">{actionError}</p>}

      <div className="card">
        <span className="plan-badge">{t('currentPlan')}</span>
        <p style={{ margin: 0 }}>
          <strong>{planLabel}</strong> — {statusLabel}
          {status.price_month !== null && <> — {t('perMonth', { price: status.price_month })}</>}
        </p>
        {status.status !== 'trial' && (
          <>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={openPortal}>
              {t('manageSubscription')}
            </button>

            <form onSubmit={applyPromoCode} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder={t('promoCodePlaceholder')}
              />
              <button type="submit" className="btn btn-secondary" disabled={promoStatus === 'loading' || !promoCode.trim()}>
                {promoStatus === 'loading' ? t('promoCodeApplying') : t('promoCodeApply')}
              </button>
            </form>
            {promoError && (
              <p role="alert" className="muted-link" style={{ color: 'crimson' }}>
                {promoError}
              </p>
            )}
            {promoSuccess && <p className="muted-link">{t('promoCodeSuccess')}</p>}
          </>
        )}
      </div>

      {status.status === 'trial' && <p className="muted-link">{t('trialNote', { days: 30 })}</p>}

      <ul className="pricing-grid">
        <li className={status.plan === 'equipo' ? 'current-plan' : ''}>
          <strong>{t('planEquipo')}</strong>
          <span className="price">{t('perMonth', { price: 49 })}</span>
          <p style={{ margin: '0.5rem 0 1rem' }}>{t('teamPlanDesc')}</p>
          {status.plan === 'equipo' ? (
            <span className="muted-link">{t('currentPlanBadge')}</span>
          ) : (
            <button type="button" className="btn btn-primary" disabled={pendingPlan === 'equipo'} onClick={() => subscribe('equipo')}>
              {pendingPlan === 'equipo' ? t('redirecting') : t('subscribe')}
            </button>
          )}
        </li>
        <li className={status.plan === 'organizacion' ? 'current-plan' : ''}>
          <strong>{t('planOrganizacion')}</strong>
          <span className="price">{t('perMonth', { price: 149 })}</span>
          <p style={{ margin: '0.5rem 0 1rem' }}>{t('orgPlanDesc')}</p>
          {status.plan === 'organizacion' ? (
            <span className="muted-link">{t('currentPlanBadge')}</span>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pendingPlan === 'organizacion'}
              onClick={() => subscribe('organizacion')}
            >
              {pendingPlan === 'organizacion' ? t('redirecting') : t('subscribe')}
            </button>
          )}
        </li>
      </ul>
    </AppShell>
  );
}
