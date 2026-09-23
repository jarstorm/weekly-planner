'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, ApiError, CheckinFormInfo } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

// Formulario público de checkin — sin login, sin AppShell. El token de la
// URL es la única credencial (ver docs/especificaciones-tecnicas.md,
// sección 3.5): quien lo tiene es porque le llegó en su propio email/
// WhatsApp/Telegram, no hace falta cuenta.
export default function CheckinFormPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const t = useTranslations('CheckinForm');

  const [info, setInfo] = useState<CheckinFormInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [doneText, setDoneText] = useState('');
  const [nextText, setNextText] = useState('');
  const [blockerText, setBlockerText] = useState('');

  useEffect(() => {
    api
      .getCheckinForm(token)
      .then(setInfo)
      .catch(() => setError(t('invalidLink')));
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.submitCheckinForm(token, { doneText, nextText, blockerText });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('submitError'));
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <main className="auth-page">
        <div className="auth-wrap">
          <BrandMark />
          <p role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="auth-page">
        <div className="auth-wrap">
          <BrandMark />
          <p>{t('loading')}</p>
        </div>
      </main>
    );
  }

  if (submitted || info.alreadySubmitted) {
    return (
      <main className="auth-page">
        <div className="auth-wrap">
          <BrandMark />
          <div className="card" style={{ textAlign: 'center' }}>
            <CheckCircle2 size={32} color="var(--color-brand)" />
            <p>{t('thanks', { memberName: info.memberName })}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <BrandMark />
        <div className="card">
          <h1>{t('title', { teamName: info.teamName })}</h1>
          <p>{t('greeting', { memberName: info.memberName })}</p>
          <form onSubmit={handleSubmit}>
            <label>
              {t('done')}
              <textarea value={doneText} onChange={(e) => setDoneText(e.target.value)} required />
            </label>
            <label>
              {t('next')}
              <textarea value={nextText} onChange={(e) => setNextText(e.target.value)} />
            </label>
            <label>
              {t('blocker')}
              <textarea value={blockerText} onChange={(e) => setBlockerText(e.target.value)} />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
