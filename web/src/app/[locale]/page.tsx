import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tNav = useTranslations('Nav');

  return (
    <main className="page">
      <nav className="topbar">
        <strong>{t('title')}</strong>
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

      <h2>{t('howItWorksTitle')}</h2>
      <ol className="steps">
        <li>{t('step1')}</li>
        <li>{t('step2')}</li>
        <li>{t('step3')}</li>
      </ol>

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
    </main>
  );
}
