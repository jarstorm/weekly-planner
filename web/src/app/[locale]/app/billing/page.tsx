'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
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
  // Bajar de plan borra el resto de equipos de la cuenta (ver
  // BillingService.changePlan) — se pide confirmación explícita antes de
  // llamar al backend, no se borra nada al primer clic.
  const [confirmingDowngradeTo, setConfirmingDowngradeTo] = useState<'equipo' | 'organizacion' | null>(null);

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

  const PLAN_RANK = { equipo: 1, organizacion: 2 } as const;

  function subscribe(plan: 'equipo' | 'organizacion') {
    // Bajar de plan (Organización -> Equipo) se lleva por delante el resto
    // de equipos de la cuenta — se avisa antes de tocar nada.
    if (status && PLAN_RANK[plan] < PLAN_RANK[status.plan as 'equipo' | 'organizacion']) {
      setConfirmingDowngradeTo(plan);
      return;
    }
    void changePlan(plan);
  }

  async function changePlan(plan: 'equipo' | 'organizacion') {
    setActionError(null);
    setPendingPlan(plan);
    try {
      const result = await api.changePlan(plan);
      if ('url' in result) {
        window.location.href = result.url;
        return;
      }
      // Cambio hecho en el sitio (ya había suscripción) — se refresca el
      // estado en vez de redirigir a Stripe.
      const updated = await api.billingStatus();
      setStatus(updated);
      setConfirmingDowngradeTo(null);
    } catch {
      setActionError(t('checkoutError'));
    } finally {
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

      {checkoutResult === 'success' && (
        <div className="card">
          <p style={{ margin: 0 }}>{t('checkoutSuccess')}</p>
          <Link className="btn btn-primary" style={{ marginTop: '1rem' }} href="/app/onboarding">
            {t('checkoutSuccessNextStep')}
          </Link>
        </div>
      )}
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

      {confirmingDowngradeTo && (
        <div className="card" style={{ borderColor: 'var(--color-danger, crimson)' }}>
          <p style={{ margin: 0 }}>
            {t('downgradeWarning', {
              plan: confirmingDowngradeTo === 'equipo' ? t('planEquipo') : t('planOrganizacion'),
            })}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDowngradeTo(null)}>
              {t('downgradeCancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pendingPlan === confirmingDowngradeTo}
              onClick={() => changePlan(confirmingDowngradeTo)}
            >
              {pendingPlan === confirmingDowngradeTo ? t('processing') : t('downgradeConfirm')}
            </button>
          </div>
        </div>
      )}

      <ul className="pricing-grid">
        <li className={status.plan === 'equipo' ? 'current-plan' : ''}>
          <strong>{t('planEquipo')}</strong>
          <span className="price">{t('perMonth', { price: 49 })}</span>
          <p style={{ margin: '0.5rem 0 1rem' }}>{t('teamPlanDesc')}</p>
          {status.plan === 'equipo' ? (
            <span className="muted-link">{t('currentPlanBadge')}</span>
          ) : (
            <button type="button" className="btn btn-primary" disabled={pendingPlan === 'equipo'} onClick={() => subscribe('equipo')}>
              {pendingPlan === 'equipo' ? t('processing') : t('subscribe')}
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
              {pendingPlan === 'organizacion' ? t('processing') : t('subscribe')}
            </button>
          )}
        </li>
      </ul>
    </AppShell>
  );
}
