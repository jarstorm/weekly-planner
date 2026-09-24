'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, ApiError, SurveyFormInfo } from '@/lib/api';
import { BrandMark } from '@/components/BrandMark';

// Formulario público de la encuesta mensual — sin login, sin AppShell,
// mismo criterio de token-como-credencial que /checkin/[token]. El aviso
// de anonimato es el elemento más visible de la página a propósito: el
// pedido explícito es que quede claro para que el feedback sea más
// honesto, no solo que lo sea técnicamente (ver migración 0010).
export default function SurveyFormPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const t = useTranslations('SurveyForm');

  const [info, setInfo] = useState<SurveyFormInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);

  useEffect(() => {
    api
      .getSurveyForm(token)
      .then((form) => {
        setInfo(form);
        setAnswers(form.questions.map(() => ''));
      })
      .catch(() => setError(t('invalidLink')));
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.submitSurveyForm(token, answers);
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
            <p>{t('thanks')}</p>
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
          <h1>{t('title', { organizationName: info.organizationName })}</h1>
          <p className="field-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} />
            {t('anonymityNotice')}
          </p>
          <form onSubmit={handleSubmit}>
            {info.questions.map((question, i) => (
              <label key={i}>
                {question}
                <textarea
                  value={answers[i]}
                  onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                />
              </label>
            ))}
            <button type="submit" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
