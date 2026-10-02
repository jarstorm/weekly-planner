'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, Organization, PendingSurvey, SurveyListItem, SurveyResults } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

// Sección propia del menú (pedido explícito, antes vivía dentro de
// "Configuración del feedback" junto con el horario de los informes, que
// ahora tiene su propia sección — ver /app/reports): crear/ver la encuesta
// pendiente (de un solo envío, migración 0018) y los resultados de las ya
// enviadas, agrupados por pregunta, nunca por persona — survey_responses
// no guarda member_id/team_id, así que no hay forma de listar "quién dijo
// qué" ni aunque quisiéramos.
export default function SurveyPage() {
  const t = useTranslations('Survey');

  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined = todavía cargando, null = no hay ninguna pendiente.
  const [pendingSurvey, setPendingSurvey] = useState<PendingSurvey | null | undefined>(undefined);

  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null);
  const [surveyId, setSurveyId] = useState<string>('');
  const [results, setResults] = useState<SurveyResults | null>(null);

  useEffect(() => {
    api.getOrganization().then(setOrg).catch(() => setError(t('loadError')));
    api
      .getPendingSurvey()
      .then(setPendingSurvey)
      .catch(() => setPendingSurvey(null));
    api
      .listSurveys()
      .then((list) => {
        setSurveys(list);
        if (list.length > 0) setSurveyId(list[0].id);
      })
      .catch(() => setError(t('loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!surveyId) return;
    api
      .getSurveyResults(surveyId)
      .then(setResults)
      .catch(() => setError(t('loadError')));
  }, [surveyId, t]);

  if (error && !org) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (!org) {
    return (
      <AppShell>
        <FormSkeleton rows={4} />
      </AppShell>
    );
  }

  // Nunca disponible en Plan Equipo — es de cuenta, no por equipo
  // (SurveyService.createSurvey la rechaza igual si el plan no coincide).
  const surveyAvailable = org.plan === 'organizacion' || org.plan === 'custom';
  if (!surveyAvailable) {
    return (
      <AppShell>
        <h1>{t('title')}</h1>
        <div className="card">
          <p className="muted-link">{t('notAvailable')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>
      {error && <p role="alert">{error}</p>}

      <div className="card">
        {pendingSurvey === undefined ? (
          <p className="muted-link">{t('loading')}</p>
        ) : pendingSurvey ? (
          <>
            <p style={{ margin: 0 }}>
              {t('surveyPendingInfo', {
                date: pendingSurvey.scheduledDate,
                time: pendingSurvey.scheduledTime,
                timezone: pendingSurvey.timezone,
                count: pendingSurvey.questions.length,
              })}
            </p>
            <p className="field-hint">{t('surveyPendingHint')}</p>
          </>
        ) : (
          <>
            <p className="field-hint">{t('surveyEmptyHint')}</p>
            <Link href="/app/survey/new" className="btn btn-primary">
              <CalendarPlus size={16} />
              {t('surveyCreateButton')}
            </Link>
          </>
        )}
      </div>

      <h2 className="dashboard-section-title">{t('resultsTitle')}</h2>

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
