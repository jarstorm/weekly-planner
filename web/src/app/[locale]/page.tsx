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
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { BrandMark } from '@/components/BrandMark';
import { HeroVisual } from '@/components/HeroVisual';
import { Reveal } from '@/components/Reveal';

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tNav = useTranslations('Nav');
  const tLegal = useTranslations('Legal');

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
        <div className="hero-bg-blobs" aria-hidden="true">
          <span className="hero-bg-blob hero-bg-blob-1" />
          <span className="hero-bg-blob hero-bg-blob-2" />
          <span className="hero-bg-blob hero-bg-blob-3" />
        </div>
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

        <div className="hero-visual">
          <HeroVisual src="/landing/report-sample-hero.png" alt={t('sampleAlt')} />
        </div>
      </section>

      <section className="proof-band">
        <div className="proof-inner">
          <Reveal>
            <h2>{t('proofTitle')}</h2>
            <p>{t('proofDesc')}</p>
          </Reveal>
          <div className="proof-grid">
            <Reveal className="proof-item" delay={0}>
              <span className="proof-icon"><ShieldCheck size={20} /></span>
              <strong>{t('proof1Title')}</strong>
              <p>{t('proof1Desc')}</p>
            </Reveal>
            <Reveal className="proof-item" delay={80}>
              <span className="proof-icon"><Sparkles size={20} /></span>
              <strong>{t('proof2Title')}</strong>
              <p>{t('proof2Desc')}</p>
            </Reveal>
            <Reveal className="proof-item" delay={160}>
              <span className="proof-icon"><Smartphone size={20} /></span>
              <strong>{t('proof3Title')}</strong>
              <p>{t('proof3Desc')}</p>
            </Reveal>
            <Reveal className="proof-item" delay={240}>
              <span className="proof-icon"><RefreshCw size={20} /></span>
              <strong>{t('proof4Title')}</strong>
              <p>{t('proof4Desc')}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <Reveal>
          <h2>{t('howItWorksTitle')}</h2>
          <p className="section-desc">{t('howItWorksDesc')}</p>
        </Reveal>
        <ol className="steps">
          <li>
            <Reveal delay={0}>
              <div className="step-top">
                <span className="step-number">1</span>
                <span className="step-icon"><CalendarClock size={20} /></span>
              </div>
              <strong>{t('step1Title')}</strong>
              <p>{t('step1')}</p>
            </Reveal>
          </li>
          <li>
            <Reveal delay={100}>
              <div className="step-top">
                <span className="step-number">2</span>
                <span className="step-icon"><MessageCircle size={20} /></span>
              </div>
              <strong>{t('step2Title')}</strong>
              <p>{t('step2')}</p>
            </Reveal>
          </li>
          <li>
            <Reveal delay={200}>
              <div className="step-top">
                <span className="step-number">3</span>
                <span className="step-icon"><FileCheck2 size={20} /></span>
              </div>
              <strong>{t('step3Title')}</strong>
              <p>{t('step3')}</p>
            </Reveal>
          </li>
        </ol>
      </section>

      <section className="landing-section landing-section-sample">
        <Reveal>
          <h2>{t('sampleTitle')}</h2>
          <p className="section-desc">{t('sampleDesc')}</p>
        </Reveal>
        <Reveal delay={120} className="report-mock report-mock-full">
          <div className="report-mock-photo-frame">
            <img src="/landing/report-sample-full.png" alt={t('sampleAlt')} />
          </div>
          <ul className="member-status-list">
            <li className="responded"><CheckCircle2 size={14} /> Ana</li>
            <li className="responded"><CheckCircle2 size={14} /> Bruno</li>
            <li className="responded"><CheckCircle2 size={14} /> Carla</li>
          </ul>
        </Reveal>
      </section>

      <section className="landing-section" id="pricing">
        <Reveal>
          <h2>{t('pricingTitle')}</h2>
          <p className="section-desc">{t('pricingDesc')}</p>
        </Reveal>
        <ul className="pricing-grid">
          <li>
            <Reveal delay={0}>
              <strong>{t('planTeam')}</strong>
              <span className="price">{t('planTeamPrice')}</span>
              <p style={{ margin: '0.5rem 0 0' }}>{t('planTeamDesc')}</p>
            </Reveal>
          </li>
          <li className="pricing-featured">
            <Reveal delay={100}>
              <strong>{t('planOrg')}</strong>
              <span className="price">{t('planOrgPrice')}</span>
              <p style={{ margin: '0.5rem 0 0' }}>{t('planOrgDesc')}</p>
              <span className="plan-badge plan-badge-bottom">{t('planPopular')}</span>
            </Reveal>
          </li>
          <li>
            <Reveal delay={200}>
              <strong>{t('planCustom')}</strong>
              <span className="price">{t('planCustomPrice')}</span>
              <p style={{ margin: '0.5rem 0 0' }}>{t('planCustomDesc')}</p>
              <a className="btn btn-secondary" style={{ marginTop: '0.75rem' }} href="mailto:contact@zaviren.com">
                {t('planCustomCta')}
              </a>
            </Reveal>
          </li>
        </ul>
        <p className="muted-link price-note">{t('priceNote')}</p>

        <Reveal delay={150} className="plan-compare-wrap">
          <h3 className="plan-compare-title">{t('compareTitle')}</h3>
          <table className="plan-compare-table">
            <thead>
              <tr>
                <th>{t('compareFeature')}</th>
                <th>{t('planTeam')}</th>
                <th>{t('planOrg')}</th>
                <th>{t('planCustom')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('compareTeams')}</td>
                <td>{t('compareTeamsTeam')}</td>
                <td>{t('compareTeamsOrg')}</td>
                <td>{t('compareTeamsCustom')}</td>
              </tr>
              <tr>
                <td>{t('compareMembers')}</td>
                <td>{t('compareMembersTeam')}</td>
                <td>{t('compareMembersOrg')}</td>
                <td>{t('compareMembersCustom')}</td>
              </tr>
              <tr>
                <td>{t('compareChannels')}</td>
                <td>{t('compareChannelsValue')}</td>
                <td>{t('compareChannelsValue')}</td>
                <td>{t('compareChannelsValue')}</td>
              </tr>
              <tr>
                <td>{t('compareReports')}</td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
              </tr>
              <tr>
                <td>{t('compareExecSummary')}</td>
                <td><X size={16} className="plan-compare-no" /></td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
              </tr>
              <tr>
                <td>{t('compareSurvey')}</td>
                <td><X size={16} className="plan-compare-no" /></td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
                <td><CheckCircle2 size={16} className="plan-compare-yes" /></td>
              </tr>
              <tr>
                <td>{t('comparePrice')}</td>
                <td>{t('planTeamPrice')}</td>
                <td>{t('planOrgPrice')}</td>
                <td>{t('planCustomPrice')}</td>
              </tr>
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="landing-section" id="faq">
        <Reveal>
          <h2>{t('faqTitle')}</h2>
        </Reveal>
        <Reveal delay={100} className="faq-list">
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
          <div className="faq-item">
            <strong>{t('faq6Q')}</strong>
            <p>{t('faq6A')}</p>
          </div>
        </Reveal>
      </section>

      <section className="final-cta">
        <Reveal className="final-cta-inner">
          <h2>{t('finalCtaTitle')}</h2>
          <p>{t('finalCtaDesc')}</p>
          <Link className="btn btn-primary btn-lg" href="/register">{t('cta')}</Link>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <BrandMark />
          <p>{t('footerTagline')}</p>
          <nav className="landing-footer-links">
            <Link href="/legal/terms">{tLegal('termsLink')}</Link>
            <Link href="/legal/privacy">{tLegal('privacyLink')}</Link>
          </nav>
          <p className="muted-link">© {new Date().getFullYear()} WeeklyFeedback. {t('footerRights')}</p>
        </div>
      </footer>
    </main>
  );
}
