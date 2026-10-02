'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { AppShell } from '@/components/AppShell';
import { QuestionsEditor } from '@/components/QuestionsEditor';

const TIMEZONE_OPTIONS = Intl.supportedValuesOf('timeZone');
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Encuesta anónima de un solo envío (migración 0018, pedido explícito: ya
// no es "mensual recurrente" — fecha, hora y timezone propios de ESTA
// encuesta, no los del recordatorio semanal de la cuenta). Solo llega
// aquí si no hay ya una pendiente (FeedbackConfigPage no ofrece el botón
// en ese caso) — el backend igual lo vuelve a comprobar.
export default function NewSurveyPage() {
  const router = useRouter();
  const t = useTranslations('NewSurvey');

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState(TIMEZONE_OPTIONS.includes(BROWSER_TIMEZONE) ? BROWSER_TIMEZONE : 'Europe/Madrid');
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (questions.length === 0) {
      setError(t('noQuestionsError'));
      return;
    }
    setSaving(true);
    try {
      await api.createSurvey({ questions, scheduledDate, scheduledTime, timezone });
      trackEvent('survey_create');
      router.push('/app/feedback');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <Link href="/app/feedback" className="back-link">
        <ArrowLeft size={16} />
        {t('back')}
      </Link>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            {t('date')}
            <input
              type="date"
              value={scheduledDate}
              min={todayDateString()}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </label>
          <label>
            {t('time')}
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />
          </label>
          <label>
            {t('timezone')}
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} required>
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('questions')}
            <QuestionsEditor
              questions={questions}
              onChange={setQuestions}
              placeholder={t('questionsPlaceholder')}
              addLabel={t('questionsAdd')}
              limitHint={t('questionsLimit')}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? t('creating') : t('create')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
