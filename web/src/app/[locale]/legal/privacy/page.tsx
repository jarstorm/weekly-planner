import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandMark } from '@/components/BrandMark';

interface LegalSection {
  heading: string;
  body: string;
}

export default function PrivacyPage() {
  const t = useTranslations('Legal');
  const sections = t.raw('privacySections') as LegalSection[];

  return (
    <main className="page legal-page">
      <Link href="/"><BrandMark /></Link>
      <h1>{t('privacyTitle')}</h1>
      <p className="muted-link">{t('lastUpdated')}</p>
      <p role="alert">{t('placeholderNotice')}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </main>
  );
}
