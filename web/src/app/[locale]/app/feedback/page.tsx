'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, ChannelName, Organization } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

// Configuración del "loop de feedback" — pantalla propia, no una sección
// más dentro de "Datos de la empresa" (pedido explícito): es lo primero
// que alguien quiere tocar/revisar, así que tiene su propio link desde el
// dashboard (sección 0.15 del doc técnico), no queda escondida entre
// nombre/país/contacto de la cuenta.
export default function FeedbackConfigPage() {
  const t = useTranslations('Settings');
  const tChannel = useTranslations('Channel');
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
        delivery_channel: org.delivery_channel,
        delivery_target: org.delivery_target,
        reminder_dow: org.reminder_dow,
        reminder_time: org.reminder_time,
        cutoff_time: org.cutoff_time,
        timezone: org.timezone,
      });
      setOrg({ ...org, ...updated });
      setSaved(true);
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
            {t('deliveryChannel')}
            <select
              value={org.delivery_channel}
              onChange={(e) => setOrg({ ...org, delivery_channel: e.target.value as ChannelName })}
            >
              <option value="email">{tChannel('email')}</option>
              <option value="telegram">{tChannel('telegram')}</option>
            </select>
          </label>
          <label>
            {t('deliveryTarget')}
            <input
              type="text"
              placeholder={
                org.delivery_channel === 'telegram' ? t('memberContactTelegramPlaceholder') : t('memberContactEmailPlaceholder')
              }
              value={org.delivery_target ?? ''}
              onChange={(e) => setOrg({ ...org, delivery_target: e.target.value })}
              required
            />
          </label>
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
            <input
              type="text"
              value={org.timezone}
              onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
              placeholder="Europe/Madrid"
              required
            />
          </label>
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
