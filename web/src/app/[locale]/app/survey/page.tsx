'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, SurveyResults } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

// Panel de resultados de la encuesta mensual — muestra las respuestas
// agrupadas por pregunta, nunca por persona: la tabla survey_responses no
// guarda member_id/team_id (ver migración 0010), así que no hay forma de
// listar "quién dijo qué" ni aunque quisiéramos.
export default function SurveyResultsPage() {
  const t = useTranslations('Survey');

  const [periods, setPeriods] = useState<string[] | null>(null);
  const [period, setPeriod] = useState<string>('');
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSurveyPeriods()
      .then((list) => {
        setPeriods(list);
        if (list.length > 0) setPeriod(list[0]);
      })
      .catch(() => setError(t('loadError')));
  }, [t]);

  useEffect(() => {
    if (!period) return;
    api
      .getSurveyResults(period)
      .then(setResults)
      .catch(() => setError(t('loadError')));
  }, [period, t]);

  return (
    <AppShell>
      <Link href="/app/feedback" className="back-link">
        <ArrowLeft size={16} />
        {t('back')}
      </Link>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>

      {error && <p role="alert">{error}</p>}

      {periods === null && <FormSkeleton rows={4} />}

      {periods !== null && periods.length === 0 && <p className="muted-link">{t('noPeriods')}</p>}

      {periods !== null && periods.length > 0 && (
        <div className="card">
          <label>
            {t('periodLabel')}
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p.slice(0, 7)}
                </option>
              ))}
            </select>
          </label>

          {results && (
            <>
              <p className="muted-link">
                {t('participation', { submitted: results.submittedCount, total: results.totalActiveMembers })}
              </p>
              {results.questions.map((question, i) => (
                <div key={i} className="survey-question-block">
                  <strong>{question}</strong>
                  {results.answersByQuestion[i]?.length > 0 ? (
                    <ul className="survey-answers-list">
                      {results.answersByQuestion[i].map((answer, j) => (
                        <li key={j}>{answer}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="field-hint">{t('noAnswers')}</p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
