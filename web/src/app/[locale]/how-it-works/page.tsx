import { useTranslations } from 'next-intl';
import {
  MessageCircle,
  Sparkles,
  FileCheck2,
  Users,
  BarChart3,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { BrandMark } from '@/components/BrandMark';
import { Reveal } from '@/components/Reveal';

// Página pública de venta (sin AppShell, sin login) — pensada para que un
// posible cliente entienda el flujo completo antes de registrarse, más
// detallada que la sección "Cómo funciona" de la landing (3 pasos, de
// pasada). Reutiliza las clases .landing-page/.landing-section de la
// landing para que se vea parte del mismo sitio, no una página aparte.
export default function HowItWorksPage() {
  const t = useTranslations('HowItWorks');
  const tNav = useTranslations('Nav');
  const tLegal = useTranslations('Legal');
  const tLanding = useTranslations('Landing');

  return (
    <main className="landing-page">
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

      <section className="landing-section" style={{ paddingBottom: 0 }}>
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          {t('backToHome')}
        </Link>
        <Reveal className="hiw-hero">
          <span className="eyebrow">{t('badge')}</span>
          <h1 style={{ marginTop: '0.5rem' }}>{t('title')}</h1>
          <p className="section-desc">{t('intro')}</p>
        </Reveal>
      </section>

      <section className="landing-section" id="setup">
        <Reveal direction="left">
          <div className="hiw-badge">
            <span className="hiw-badge-number">1</span>
            <Users size={28} />
          </div>
          <h2>{t('step1Title')}</h2>
          <p className="section-desc">{t('step1Desc')}</p>
        </Reveal>
      </section>

      <section className="landing-section landing-section-watermark">
        <Reveal>
          <div className="hiw-badge">
            <span className="hiw-badge-number">2</span>
            <MessageCircle size={28} />
          </div>
          <h2>{t('step2Title')}</h2>
          <p className="section-desc">{t('step2Desc')}</p>
        </Reveal>
        <Reveal delay={100} className="report-mock report-mock-full">
          <p style={{ margin: 0, fontWeight: 600 }}>{t('question1')}</p>
          <p style={{ margin: '0.75rem 0 0', fontWeight: 600 }}>{t('question2')}</p>
          <p style={{ margin: '0.75rem 0 0', fontWeight: 600 }}>{t('question3')}</p>
        </Reveal>
        <p className="muted-link" style={{ textAlign: 'center', marginTop: '1rem' }}>{t('step2Note')}</p>
      </section>

      <section className="landing-section" id="ai-report">
        <Reveal direction="right">
          <div className="hiw-badge">
            <span className="hiw-badge-number">3</span>
            <Sparkles size={28} />
          </div>
          <h2>{t('step3Title')}</h2>
          <p className="section-desc">{t('step3Desc')}</p>
        </Reveal>
      </section>

      <section className="landing-section landing-section-sample">
        <Reveal direction="left">
          <div className="hiw-badge">
            <span className="hiw-badge-number">4</span>
            <FileCheck2 size={28} />
          </div>
          <h2>{t('step4Title')}</h2>
          <p className="section-desc">{t('step4Desc')}</p>
        </Reveal>
      </section>

      <section className="landing-section">
        <Reveal>
          <div className="hiw-badge">
            <span className="hiw-badge-number">5</span>
            <BarChart3 size={28} />
          </div>
          <h2>{t('step5Title')}</h2>
          <p className="section-desc">{t('step5Desc')}</p>
        </Reveal>
        <Reveal delay={100} className="report-mock hiw-aside">
          <p>{t('step6Desc')}</p>
        </Reveal>
      </section>

      <section className="landing-section" id="security">
        <Reveal direction="right">
          <div className="hiw-badge">
            <ShieldCheck size={28} />
          </div>
          <h2>{t('securityTitle')}</h2>
          <p className="section-desc">{t('securityDesc')}</p>
        </Reveal>
      </section>

      <section className="landing-section landing-section-watermark" id="faq">
        <Reveal direction="right">
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
        </Reveal>
      </section>

      <section className="final-cta">
        <Reveal className="final-cta-inner">
          <h2>{t('ctaTitle')}</h2>
          <p>{t('ctaDesc')}</p>
          <Link className="btn btn-primary btn-lg" href="/register">{t('ctaButton')}</Link>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <BrandMark />
          <p>{tLanding('footerTagline')}</p>
          <nav className="landing-footer-links">
            <Link href="/legal/terms">{tLegal('termsLink')}</Link>
            <Link href="/legal/privacy">{tLegal('privacyLink')}</Link>
          </nav>
          <p className="muted-link">{tLanding('footerTrust')}</p>
        </div>
      </footer>
    </main>
  );
}
