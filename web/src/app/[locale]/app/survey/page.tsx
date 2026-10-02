'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, SurveyListItem, SurveyResults } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

// Panel de resultados de la encuesta anónima — muestra las respuestas
// agrupadas por pregunta, nunca por persona: survey_responses no guarda
// member_id/team_id (ver migración 0010/0018), así que no hay forma de
// listar "quién dijo qué" ni aunque quisiéramos. Cada encuesta es de un
// solo envío (migración 0018) — el selector lista las ya enviadas, más
// reciente primero.
export default function SurveyResultsPage() {
  const t = useTranslations('Survey');

  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null);
  const [surveyId, setSurveyId] = useState<string>('');
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSurveys()
      .then((list) => {
        setSurveys(list);
        if (list.length > 0) setSurveyId(list[0].id);
      })
      .catch(() => setError(t('loadError')));
  }, [t]);

  useEffect(() => {
    if (!surveyId) return;
    api
      .getSurveyResults(surveyId)
      .then(setResults)
      .catch(() => setError(t('loadError')));
  }, [surveyId, t]);

  return (
    <AppShell>
      <Link href="/app/feedback" className="back-link">
        <ArrowLeft size={16} />
        {t('back')}
      </Link>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>

      {error && <p role="alert">{error}</p>}

      {surveys === null && <FormSkeleton rows={4} />}

      {surveys !== null && surveys.length === 0 && <p className="muted-link">{t('noSurveysYet')}</p>}

      {surveys !== null && surveys.length > 0 && (
        <div className="card">
          <label>
            {t('surveyLabel')}
            <select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {t('surveyOptionLabel', { date: s.scheduledDate })}
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
