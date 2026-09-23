'use client';

import { LayoutDashboard, UserPlus, LogOut, CreditCard, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { LocaleSwitcher } from './LocaleSwitcher';
import { BrandMark } from './BrandMark';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const router = useRouter();

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
          <Link href="/app/onboarding" className={pathname === '/app/onboarding' ? 'active' : ''}>
            <UserPlus size={18} />
            <span>{t('newTeam')}</span>
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
