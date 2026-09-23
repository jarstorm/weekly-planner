'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, ApiError, ChannelName, Organization } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { countryOptions } from '@/lib/countries';
import { SettingsSkeleton } from '@/components/Skeleton';

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const tChannel = useTranslations('Channel');
  const tDay = useTranslations('Day');
  const locale = useLocale();

  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

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
        name: org.name,
        country: org.country,
        contact_name: org.contact_name,
      });
      setOrg({ ...org, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setFeedbackSaving(true);
    setFeedbackError(null);
    setFeedbackSaved(false);
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
      setFeedbackSaved(true);
    } catch (err) {
      setFeedbackError(err instanceof ApiError ? err.message : t('saveError'));
    } finally {
      setFeedbackSaving(false);
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
        <SettingsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1>{t('title')}</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            {t('companyName')}
            <input
              type="text"
              value={org.name}
              onChange={(e) => setOrg({ ...org, name: e.target.value })}
              required
            />
          </label>
          <label>
            {t('registeredEmail')}
            <input type="email" value={org.email} disabled />
          </label>
          <label>
            {t('contactName')}
            <input
              type="text"
              value={org.contact_name ?? ''}
              onChange={(e) => setOrg({ ...org, contact_name: e.target.value })}
              placeholder={t('contactNamePlaceholder')}
            />
          </label>
          <label>
            {t('country')}
            <select
              value={org.country ?? ''}
              onChange={(e) => setOrg({ ...org, country: e.target.value || null })}
            >
              <option value="">{t('countryUnset')}</option>
              {countryOptions(locale).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          {saved && <p className="muted-link">{t('saved')}</p>}
          <button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </form>
      </div>

      <h2>{t('feedbackConfigTitle')}</h2>
      <p className="muted-link">{t('feedbackConfigDescription')}</p>
      <div className="card">
        <form onSubmit={handleFeedbackSubmit}>
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
          {feedbackError && <p role="alert">{feedbackError}</p>}
          {feedbackSaved && <p className="muted-link">{t('saved')}</p>}
          <button type="submit" disabled={feedbackSaving}>
            {feedbackSaving ? t('saving') : t('save')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
