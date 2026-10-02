'use client';

import { useEffect } from 'react';
import { LayoutDashboard, LogOut, CreditCard, Building2, Users, FileText, ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { LocaleSwitcher } from './LocaleSwitcher';
import { BrandMark } from './BrandMark';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const router = useRouter();

  // Wizard de alta: registro → verificar email → login → elegir plan
  // (Stripe Checkout) → recién ahí onboarding/dashboard. plan_selected
  // queda en false hasta que BillingService confirma el primer Checkout
  // (ver billing.service.ts) — mientras tanto, cualquier página de /app/*
  // redirige a /app/billing, que ya es la pantalla de elegir plan. Sin
  // bloquear el render: si falla (p.ej. sesión caducada), cada página ya
  // maneja su propio 401 por su cuenta.
  useEffect(() => {
    if (pathname === '/app/billing') return;
    api
      .billingStatus()
      .then((status) => {
        if (!status.plan_selected) router.replace('/app/billing');
      })
      .catch(() => {});
  }, [pathname, router]);

  async function handleLogout() {
    await api.logout();
    router.push('/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <BrandMark />
        <nav className="app-nav">
          <Link href="/app" className={pathname === '/app' ? 'active' : ''}>
            <LayoutDashboard size={18} />
            <span>{t('dashboard')}</span>
          </Link>
          <Link href="/app/members" className={pathname === '/app/members' ? 'active' : ''}>
            <Users size={18} />
            <span>{t('members')}</span>
          </Link>
          <Link href="/app/reports" className={pathname === '/app/reports' ? 'active' : ''}>
            <FileText size={18} />
            <span>{t('reports')}</span>
          </Link>
          <Link href="/app/survey" className={pathname?.startsWith('/app/survey') ? 'active' : ''}>
            <ClipboardList size={18} />
            <span>{t('survey')}</span>
          </Link>
          <Link href="/app/billing" className={pathname === '/app/billing' ? 'active' : ''}>
            <CreditCard size={18} />
            <span>{t('billing')}</span>
          </Link>
          <Link href="/app/settings" className={pathname === '/app/settings' ? 'active' : ''}>
            <Building2 size={18} />
            <span>{t('settings')}</span>
          </Link>
        </nav>
        <div className="app-sidebar-footer">
          <LocaleSwitcher openDirection="up" />
          <button type="button" className="btn-ghost" onClick={handleLogout}>
            <LogOut size={16} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  );
}
