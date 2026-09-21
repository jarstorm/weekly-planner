import { useTranslations } from 'next-intl';
import { CalendarClock, FileCheck2, MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { BrandMark } from '@/components/BrandMark';

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tNav = useTranslations('Nav');

  return (
    <main>
      <nav className="landing-nav">
        <BrandMark />
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <LocaleSwitcher />
          <Link className="btn btn-secondary" href="/login">{tNav('login')}</Link>
          <Link className="btn btn-primary" href="/register">{tNav('createAccount')}</Link>
        </div>
      </nav>

      <section className="hero">
        <h1>{t('title')}</h1>
        <p className="tagline">{t('tagline')}</p>
        <p>{t('description')}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/register">{t('cta')}</Link>
        </div>
      </section>

      <section className="landing-section">
        <h2>{t('howItWorksTitle')}</h2>
        <ol className="steps">
          <li>
            <span className="step-icon"><CalendarClock size={20} /></span>
            <strong>{t('step1Title')}</strong>
            <p>{t('step1')}</p>
          </li>
          <li>
            <span className="step-icon"><MessageCircle size={20} /></span>
            <strong>{t('step2Title')}</strong>
            <p>{t('step2')}</p>
          </li>
          <li>
            <span className="step-icon"><FileCheck2 size={20} /></span>
            <strong>{t('step3Title')}</strong>
            <p>{t('step3')}</p>
          </li>
        </ol>
      </section>

      <section className="landing-section">
        <h2>{t('pricingTitle')}</h2>
        <ul className="pricing-grid">
          <li>
            <strong>{t('planTeam')}</strong>
            <span className="price">{t('planTeamPrice')}</span>
            <p style={{ margin: '0.5rem 0 0' }}>{t('planTeamDesc')}</p>
          </li>
          <li>
            <strong>{t('planOrg')}</strong>
            <span className="price">{t('planOrgPrice')}</span>
            <p style={{ margin: '0.5rem 0 0' }}>{t('planOrgDesc')}</p>
          </li>
        </ul>
        <p className="muted-link">{t('priceNote')}</p>
      </section>

      <footer className="landing-footer">WeeklyFeedback</footer>
    </main>
  );
}
