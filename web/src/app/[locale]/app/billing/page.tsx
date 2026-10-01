'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, BillingStatus } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
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
  // Cualquier cambio de plan con una suscripción YA activa (subir o bajar)
  // se confirma antes de tocar nada — cambia el precio y se cobra/abona la
  // diferencia prorrateada al momento (proration_behavior: 'always_invoice'
  // en BillingService.changePlan), y al subir de plan corta cualquier
  // trial gratuito que quedara en Stripe (trial_end: 'now'). Bajar de plan
  // además borra el resto de equipos de la cuenta. Nada de esto pasa en la
  // primera suscripción (todavía en trial): ahí no hay nada que comparar,
  // se va directo al Checkout hospedado de Stripe, que ya muestra el precio.
  const [confirmingPlanChangeTo, setConfirmingPlanChangeTo] = useState<'equipo' | 'organizacion' | null>(null);

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
    trackEvent('plan_select', { plan, context: 'billing' });
    // Con suscripción ya activa, cualquier cambio (subir o bajar) se
    // confirma antes de tocar nada — precio distinto, cobro prorrateado
    // inmediato. Sin suscripción todavía (trial sin checkout hecho), se va
    // directo a Stripe Checkout, que ya muestra el precio antes de cobrar.
    if (status && status.status !== 'trial') {
      setConfirmingPlanChangeTo(plan);
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
      setConfirmingPlanChangeTo(null);
      trackEvent('plan_change', { plan });
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
      trackEvent('billing_portal_open');
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
      trackEvent('promo_code_apply');
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
      <div className="billing-page">
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
      {actionError && <p role="alert" style={{ marginBottom: '1rem' }}>{actionError}</p>}

      {!status.plan_selected && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('choosePlanTitle')}</h2>
          <p style={{ margin: 0 }}>{t('choosePlanDesc')}</p>
        </div>
      )}

      {status.plan_selected && (
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

            <form onSubmit={applyPromoCode} className="promo-row" style={{ marginTop: '1rem' }}>
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
              <p role="alert" className="muted-link" style={{ color: 'crimson', marginTop: '0.5rem' }}>
                {promoError}
              </p>
            )}
            {promoSuccess && <p className="muted-link" style={{ marginTop: '0.5rem' }}>{t('promoCodeSuccess')}</p>}
          </>
        )}
      </div>
      )}

      {status.status === 'trial' && <p className="muted-link">{t('trialNote', { days: 30 })}</p>}

      {confirmingPlanChangeTo && status && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (pendingPlan !== confirmingPlanChangeTo) setConfirmingPlanChangeTo(null);
          }}
        >
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            {PLAN_RANK[confirmingPlanChangeTo] < PLAN_RANK[status.plan as 'equipo' | 'organizacion'] ? (
              <p style={{ margin: 0 }}>
                {t('downgradeWarning', {
                  plan: confirmingPlanChangeTo === 'equipo' ? t('planEquipo') : t('planOrganizacion'),
                })}
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                {t('upgradeWarning', {
                  plan: confirmingPlanChangeTo === 'equipo' ? t('planEquipo') : t('planOrganizacion'),
                })}
              </p>
            )}
            <p className="muted-link" style={{ marginTop: '0.5rem' }}>
              {t('planChangePriceNote', { price: confirmingPlanChangeTo === 'equipo' ? 49 : 149 })}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              {pendingPlan !== confirmingPlanChangeTo && (
                <button type="button" className="btn btn-danger" onClick={() => setConfirmingPlanChangeTo(null)}>
                  {t('planChangeCancel')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={pendingPlan === confirmingPlanChangeTo}
                onClick={() => changePlan(confirmingPlanChangeTo)}
              >
                {pendingPlan === confirmingPlanChangeTo ? t('processing') : t('planChangeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ul className="pricing-grid">
        <li className={status.plan_selected && status.plan === 'equipo' ? 'current-plan' : ''}>
          <strong>{t('planEquipo')}</strong>
          <span className="price">{t('perMonth', { price: 49 })}</span>
          <p style={{ margin: '0.5rem 0 1rem' }}>{t('teamPlanDesc')}</p>
          {status.plan_selected && status.plan === 'equipo' ? (
            <span className="muted-link">{t('currentPlanBadge')}</span>
          ) : (
            <button type="button" className="btn btn-primary" disabled={pendingPlan === 'equipo'} onClick={() => subscribe('equipo')}>
              {pendingPlan === 'equipo' ? t('processing') : t('subscribe')}
            </button>
          )}
        </li>
        <li className={status.plan_selected && status.plan === 'organizacion' ? 'current-plan' : ''}>
          <strong>{t('planOrganizacion')}</strong>
          <span className="price">{t('perMonth', { price: 149 })}</span>
          <p style={{ margin: '0.5rem 0 1rem' }}>{t('orgPlanDesc')}</p>
          {status.plan_selected && status.plan === 'organizacion' ? (
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
        <li className={status.plan === 'custom' ? 'current-plan' : ''}>
          <strong>{t('planCustom')}</strong>
          <span className="price">{t('noPrice')}</span>
          <p style={{ margin: '0.5rem 0 1rem' }}>{t('customPlanDesc')}</p>
          {status.plan === 'custom' ? (
            <span className="muted-link">{t('currentPlanBadge')}</span>
          ) : (
            <a className="btn btn-secondary" href="mailto:contact@weeklyfeedback.com">
              {t('customPlanCta')}
            </a>
          )}
        </li>
      </ul>
      <p className="muted-link price-note">{t('priceNote')}</p>
      </div>
    </AppShell>
  );
}
