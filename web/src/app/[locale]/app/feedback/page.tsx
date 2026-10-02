'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, Organization } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';
import { RecipientsEditor } from '@/components/RecipientsEditor';
import { QuestionsEditor } from '@/components/QuestionsEditor';

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
const DAY_OF_MONTH_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);
// Lista de IANA timezones del propio runtime (Node 18+/navegadores modernos)
// en vez de mantener una lista hardcodeada que se desactualiza.
const TIMEZONE_OPTIONS = Intl.supportedValuesOf('timeZone');

// Configuración del "loop de feedback" — pantalla propia, no una sección
// más dentro de "Datos de la empresa" (pedido explícito): es lo primero
// que alguien quiere tocar/revisar, así que tiene su propio link desde el
// dashboard (sección 0.15 del doc técnico), no queda escondida entre
// nombre/país/contacto de la cuenta. El destino de cada informe de equipo
// pasó a configurarse por equipo (report_recipients, migración 0009) —
// acá solo queda el horario, común a toda la cuenta, y el resumen
// ejecutivo (paso 15), que sigue siendo de cuenta porque consolida todos
// los equipos.
export default function FeedbackConfigPage() {
  const t = useTranslations('Settings');
  const tDay = useTranslations('Day');

  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getOrganization().then(setOrg).catch(() => setError(t('loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateOrganization({
        reminder_dow: org.reminder_dow,
        reminder_time: org.reminder_time,
        cutoff_time: org.cutoff_time,
        timezone: org.timezone,
        has_executive_summary: org.has_executive_summary,
        executive_summary_recipients: org.executive_summary_recipients,
        has_monthly_survey: org.has_monthly_survey,
        survey_questions: org.survey_questions,
        survey_day_of_month: org.survey_day_of_month,
      });
      setOrg({ ...org, ...updated });
      setSaved(true);
      trackEvent('feedback_schedule_update');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

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
        <FormSkeleton rows={6} />
      </AppShell>
    );
  }

  // Resumen ejecutivo: opción, nunca disponible en Plan Equipo — con un
  // solo equipo no hay nada que consolidar (org_exec_summary_plan_check
  // en schema.sql lo rechaza a nivel de base de datos igual).
  const executiveSummaryAvailable = org.plan === 'organizacion' || org.plan === 'custom';
  // Encuesta mensual anónima: misma disponibilidad que el resumen
  // ejecutivo (org_survey_plan_check en schema.sql).
  const monthlySurveyAvailable = org.plan === 'organizacion' || org.plan === 'custom';

  return (
    <AppShell>
      <Link href="/app" className="back-link">
        <ArrowLeft size={16} />
        {t('feedbackConfigBack')}
      </Link>
      <h1>{t('feedbackConfigTitle')}</h1>
      <p className="muted-link">{t('feedbackConfigDescription')}</p>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            {t('reminderDow')}
            <select
              value={org.reminder_dow}
              onChange={(e) => setOrg({ ...org, reminder_dow: Number(e.target.value) })}
            >
              {DOW_KEYS.map((key, i) => (
                <option key={key} value={i}>
                  {tDay(key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('reminderTime')}
            <input
              type="time"
              value={org.reminder_time}
              onChange={(e) => setOrg({ ...org, reminder_time: e.target.value })}
              required
            />
          </label>
          <label>
            {t('cutoffTime')}
            <input
              type="time"
              value={org.cutoff_time}
              onChange={(e) => setOrg({ ...org, cutoff_time: e.target.value })}
              required
            />
          </label>
          <label>
            {t('timezone')}
            <select
              value={org.timezone}
              onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
              required
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          {executiveSummaryAvailable && (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={org.has_executive_summary}
                  onChange={(e) => setOrg({ ...org, has_executive_summary: e.target.checked })}
                />
                {t('executiveSummaryToggle')}
              </label>
              <p className="field-hint">{t('executiveSummaryHint')}</p>
              <label>
                {t('executiveSummaryRecipients')}
                <RecipientsEditor
                  recipients={org.executive_summary_recipients}
                  onChange={(executive_summary_recipients) => setOrg({ ...org, executive_summary_recipients })}
                  placeholder={t('executiveSummaryRecipientsPlaceholder')}
                  addLabel={t('executiveSummaryRecipientsAdd')}
                  emptyHint={t('executiveSummaryRecipientsEmpty')}
                />
              </label>
            </>
          )}

          {monthlySurveyAvailable && (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={org.has_monthly_survey}
                  onChange={(e) => setOrg({ ...org, has_monthly_survey: e.target.checked })}
                />
                {t('monthlySurveyToggle')}
              </label>
              <p className="field-hint">{t('monthlySurveyHint')}</p>
              <label>
                {t('monthlySurveyDayOfMonth')}
                <select
                  value={org.survey_day_of_month}
                  onChange={(e) => setOrg({ ...org, survey_day_of_month: Number(e.target.value) })}
                >
                  {DAY_OF_MONTH_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('monthlySurveyQuestions')}
                <QuestionsEditor
                  questions={org.survey_questions}
                  onChange={(survey_questions) => setOrg({ ...org, survey_questions })}
                  placeholder={t('monthlySurveyQuestionsPlaceholder')}
                  addLabel={t('monthlySurveyQuestionsAdd')}
                  emptyHint={t('monthlySurveyQuestionsEmpty')}
                  limitHint={t('monthlySurveyQuestionsLimit')}
                />
              </label>
              <Link href="/app/survey" className="muted-link">
                {t('monthlySurveyResultsLink')}
              </Link>
            </>
          )}

          {error && <p role="alert">{error}</p>}
          {saved && <p className="muted-link">{t('saved')}</p>}
          <button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
