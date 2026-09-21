'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, ChannelName, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

export default function EditTeamPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const router = useRouter();
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');
  const tDay = useTranslations('Day');

  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    api.getTeam(teamId).then(setTeam).catch(() => setError(t('loadTeamError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateTeam(teamId, team);
      router.push(`/app/team/${teamId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveTeamError'));
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (!team) {
    return (
      <AppShell>
        <p>{t('loading')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}`} className="btn-ghost" style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} />
        {team.name}
      </Link>
      <h1>{t('teamSettingsTitle')}</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            {t('teamName')}
            <input
              type="text"
              value={team.name}
              onChange={(e) => setTeam({ ...team, name: e.target.value })}
              required
            />
          </label>
          <label>
            {t('companyContext')}
            <textarea
              value={team.company_context}
              onChange={(e) => setTeam({ ...team, company_context: e.target.value })}
            />
          </label>
          <label>
            {t('deliveryChannel')}
            <select
              value={team.delivery_channel}
              onChange={(e) => setTeam({ ...team, delivery_channel: e.target.value as ChannelName })}
            >
              <option value="email">{tChannel('email')}</option>
              <option value="whatsapp">{tChannel('whatsapp')}</option>
              <option value="telegram">{tChannel('telegram')}</option>
            </select>
          </label>
          <label>
            {t('deliveryTarget')}
            <input
              type="text"
              value={team.delivery_target}
              onChange={(e) => setTeam({ ...team, delivery_target: e.target.value })}
              required
            />
          </label>
          <label>
            {t('reminderDow')}
            <select
              value={team.reminder_dow}
              onChange={(e) => setTeam({ ...team, reminder_dow: Number(e.target.value) })}
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
              value={team.reminder_time}
              onChange={(e) => setTeam({ ...team, reminder_time: e.target.value })}
              required
            />
          </label>
          <label>
            {t('cutoffTime')}
            <input
              type="time"
              value={team.cutoff_time}
              onChange={(e) => setTeam({ ...team, cutoff_time: e.target.value })}
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? t('saving') : t('saveTeam')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
