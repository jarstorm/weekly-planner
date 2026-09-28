'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, ApiError, Organization } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { AppShell } from '@/components/AppShell';
import { countryOptions } from '@/lib/countries';
import { SettingsSkeleton } from '@/components/Skeleton';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();

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
        name: org.name,
        country: org.country,
        contact_name: org.contact_name,
        language: org.language,
      });
      setOrg({ ...org, ...updated });
      setSaved(true);
      trackEvent('settings_update');
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
          <label>
            {t('accountLanguage')}
            <select
              value={org.language}
              onChange={(e) => setOrg({ ...org, language: e.target.value as 'es' | 'en' })}
            >
              <option value="es">{t('accountLanguageEs')}</option>
              <option value="en">{t('accountLanguageEn')}</option>
            </select>
          </label>
          <p className="field-hint">{t('accountLanguageHint')}</p>
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
