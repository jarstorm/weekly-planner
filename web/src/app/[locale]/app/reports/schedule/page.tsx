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

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
// Lista de IANA timezones del propio runtime (Node 18+/navegadores modernos)
// en vez de mantener una lista hardcodeada que se desactualiza.
const TIMEZONE_OPTIONS = Intl.supportedValuesOf('timeZone');

// Pantalla propia, a la que se llega desde la card "Planificar informe" en
// /app/reports (pedido explícito) — no el formulario inline en el propio
// dashboard de informes.
export default function ReportSchedulePage() {
  const t = useTranslations('ReportSchedule');
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

  // El resumen ejecutivo nunca está disponible en Plan Equipo — con un
  // solo equipo no hay nada que consolidar (org_exec_summary_plan_check
  // en schema.sql).
  const executiveSummaryAvailable = org.plan === 'organizacion' || org.plan === 'custom';

  return (
    <AppShell>
      <Link href="/app/reports" className="back-link">
        <ArrowLeft size={16} />
        {t('back')}
      </Link>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>
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
