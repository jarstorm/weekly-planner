import { useTranslations } from 'next-intl';
import {
  CalendarClock,
  FileCheck2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Smartphone,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { BrandMark } from '@/components/BrandMark';

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tNav = useTranslations('Nav');

  return (
    <main>
      <div className="landing-nav-bar">
        <nav className="landing-nav">
          <BrandMark />
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <LocaleSwitcher />
            <Link className="btn btn-secondary" href="/login">{tNav('login')}</Link>
            <Link className="btn btn-primary" href="/register">{tNav('createAccount')}</Link>
          </div>
        </nav>
      </div>

      <section className="hero">
        <span className="eyebrow">{t('badge')}</span>
        <h1 className="brand-word">
          Weekly<b>Feedback</b>
        </h1>
        <p className="tagline">{t('tagline')}</p>
        <p>{t('description')}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary btn-lg" href="/register">{t('cta')}</Link>
          <a className="btn btn-secondary btn-lg" href="#how-it-works">{t('ctaSecondary')}</a>
        </div>
        <p className="trust-note">{t('trustNote')}</p>

        <div className="hero-visual" aria-hidden="true">
          <div className="report-mock">
            <div className="report-mock-header">
              <span className="report-mock-badge">{t('sampleBadge')}</span>
              <span className="muted-link">{t('sampleFooter')}</span>
            </div>
            <strong>{t('sampleReportTitle')}</strong>
            <p className="report-mock-section-title">{t('sampleWinsTitle')}</p>
            <ul>
              <li>{t('sampleWin1')}</li>
              <li>{t('sampleWin2')}</li>
            </ul>
            <p className="report-mock-section-title">{t('sampleBlockersTitle')}</p>
            <ul>
              <li>{t('sampleBlocker1')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="proof-band">
        <div className="proof-inner">
          <h2>{t('proofTitle')}</h2>
          <p>{t('proofDesc')}</p>
          <div className="proof-grid">
            <div className="proof-item">
              <span className="proof-icon"><ShieldCheck size={20} /></span>
              <strong>{t('proof1Title')}</strong>
              <p>{t('proof1Desc')}</p>
            </div>
            <div className="proof-item">
              <span className="proof-icon"><Sparkles size={20} /></span>
              <strong>{t('proof2Title')}</strong>
              <p>{t('proof2Desc')}</p>
            </div>
            <div className="proof-item">
              <span className="proof-icon"><Smartphone size={20} /></span>
              <strong>{t('proof3Title')}</strong>
              <p>{t('proof3Desc')}</p>
            </div>
            <div className="proof-item">
              <span className="proof-icon"><RefreshCw size={20} /></span>
              <strong>{t('proof4Title')}</strong>
              <p>{t('proof4Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <h2>{t('howItWorksTitle')}</h2>
        <p className="section-desc">{t('howItWorksDesc')}</p>
        <ol className="steps">
          <li>
            <div className="step-top">
              <span className="step-number">1</span>
              <span className="step-icon"><CalendarClock size={20} /></span>
            </div>
            <strong>{t('step1Title')}</strong>
            <p>{t('step1')}</p>
          </li>
          <li>
            <div className="step-top">
              <span className="step-number">2</span>
              <span className="step-icon"><MessageCircle size={20} /></span>
            </div>
            <strong>{t('step2Title')}</strong>
            <p>{t('step2')}</p>
          </li>
          <li>
            <div className="step-top">
              <span className="step-number">3</span>
              <span className="step-icon"><FileCheck2 size={20} /></span>
            </div>
            <strong>{t('step3Title')}</strong>
            <p>{t('step3')}</p>
          </li>
        </ol>
      </section>

      <section className="landing-section landing-section-sample">
        <h2>{t('sampleTitle')}</h2>
        <p className="section-desc">{t('sampleDesc')}</p>
        <div className="report-mock report-mock-full">
          <div className="report-mock-header">
            <span className="report-mock-badge">{t('sampleBadge')}</span>
            <span className="muted-link">{t('sampleFooter')}</span>
          </div>
          <strong>{t('sampleReportTitle')}</strong>
          <p className="report-mock-section-title">{t('sampleWinsTitle')}</p>
          <ul>
            <li>{t('sampleWin1')}</li>
            <li>{t('sampleWin2')}</li>
          </ul>
          <p className="report-mock-section-title">{t('sampleBlockersTitle')}</p>
          <ul>
            <li>{t('sampleBlocker1')}</li>
          </ul>
          <p className="report-mock-section-title">{t('sampleNextTitle')}</p>
          <ul>
            <li>{t('sampleNext1')}</li>
            <li>{t('sampleNext2')}</li>
          </ul>
          <ul className="member-status-list">
            <li className="responded"><CheckCircle2 size={14} /> Ana</li>
            <li className="responded"><CheckCircle2 size={14} /> Bruno</li>
            <li className="responded"><CheckCircle2 size={14} /> Carla</li>
          </ul>
        </div>
      </section>

      <section className="landing-section" id="pricing">
        <h2>{t('pricingTitle')}</h2>
        <p className="section-desc">{t('pricingDesc')}</p>
        <ul className="pricing-grid">
          <li>
            <strong>{t('planTeam')}</strong>
            <span className="price">{t('planTeamPrice')}</span>
            <p style={{ margin: '0.5rem 0 0' }}>{t('planTeamDesc')}</p>
          </li>
          <li className="pricing-featured">
            <strong>{t('planOrg')}</strong>
            <span className="price">{t('planOrgPrice')}</span>
            <p style={{ margin: '0.5rem 0 0' }}>{t('planOrgDesc')}</p>
            <span className="plan-badge plan-badge-bottom">{t('planPopular')}</span>
          </li>
        </ul>
        <p className="muted-link price-note">{t('priceNote')}</p>
      </section>

      <section className="landing-section" id="faq">
        <h2>{t('faqTitle')}</h2>
        <div className="faq-list">
          <div className="faq-item">
            <strong>{t('faq1Q')}</strong>
            <p>{t('faq1A')}</p>
          </div>
          <div className="faq-item">
            <strong>{t('faq2Q')}</strong>
            <p>{t('faq2A')}</p>
          </div>
          <div className="faq-item">
            <strong>{t('faq3Q')}</strong>
            <p>{t('faq3A')}</p>
          </div>
          <div className="faq-item">
            <strong>{t('faq4Q')}</strong>
            <p>{t('faq4A')}</p>
          </div>
          <div className="faq-item">
            <strong>{t('faq5Q')}</strong>
            <p>{t('faq5A')}</p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta-inner">
          <h2>{t('finalCtaTitle')}</h2>
          <p>{t('finalCtaDesc')}</p>
          <Link className="btn btn-primary btn-lg" href="/register">{t('cta')}</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <BrandMark />
          <p>{t('footerTagline')}</p>
          <p className="muted-link">© {new Date().getFullYear()} WeeklyFeedback. {t('footerRights')}</p>
        </div>
      </footer>
    </main>
  );
}
