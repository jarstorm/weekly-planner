'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, ChannelName, Team } from '@/lib/api';

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations('Onboarding');
  const tChannel = useTranslations('Channel');
  const tDay = useTranslations('Day');
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // datos del equipo
  const [name, setName] = useState('');
  const [companyContext, setCompanyContext] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<ChannelName>('email');
  const [deliveryTarget, setDeliveryTarget] = useState('');
  const [reminderDow, setReminderDow] = useState(5);
  const [reminderTime, setReminderTime] = useState('10:00');
  const [cutoffTime, setCutoffTime] = useState('13:00');

  // alta de miembros, una vez el equipo existe
  const [memberName, setMemberName] = useState('');
  const [memberChannel, setMemberChannel] = useState<ChannelName>('email');
  const [memberContact, setMemberContact] = useState('');
  const [members, setMembers] = useState<string[]>([]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await api.createTeam({
        name,
        company_context: companyContext,
        delivery_channel: deliveryChannel,
        delivery_target: deliveryTarget,
        reminder_dow: reminderDow,
        reminder_time: reminderTime,
        cutoff_time: cutoffTime,
      });
      setTeam(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('createTeamError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setError(null);
    setLoading(true);
    try {
      await api.addMember(team.id, { name: memberName, channel: memberChannel, contact: memberContact });
      setMembers((prev) => [...prev, memberName]);
      setMemberName('');
      setMemberContact('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('addMemberError'));
    } finally {
      setLoading(false);
    }
  }

  if (!team) {
    return (
      <main className="page">
        <h1>{t('createTeamTitle')}</h1>
        <div className="card">
        <form onSubmit={handleCreateTeam}>
          <label>
            {t('teamName')}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t('companyContext')}
            <textarea value={companyContext} onChange={(e) => setCompanyContext(e.target.value)} />
          </label>
          <label>
            {t('deliveryChannel')}
            <select value={deliveryChannel} onChange={(e) => setDeliveryChannel(e.target.value as ChannelName)}>
              <option value="email">{tChannel('email')}</option>
              <option value="whatsapp">{tChannel('whatsapp')}</option>
              <option value="telegram">{tChannel('telegram')}</option>
            </select>
          </label>
          <label>
            {t('deliveryTarget')}
            <input type="text" value={deliveryTarget} onChange={(e) => setDeliveryTarget(e.target.value)} required />
          </label>
          <label>
            {t('reminderDow')}
            <select value={reminderDow} onChange={(e) => setReminderDow(Number(e.target.value))}>
              {DOW_KEYS.map((key, i) => (
                <option key={key} value={i}>
                  {tDay(key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('reminderTime')}
            <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} required />
          </label>
          <label>
            {t('cutoffTime')}
            <input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} required />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? t('createTeamSubmitLoading') : t('createTeamSubmit')}
          </button>
        </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>{t('membersTitle', { teamName: team.name })}</h1>
      <div className="card">
      {members.length > 0 && (
        <ul className="member-list">
          {members.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAddMember}>
        <label>
          {t('memberName')}
          <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
        </label>
        <label>
          {t('memberChannel')}
          <select value={memberChannel} onChange={(e) => setMemberChannel(e.target.value as ChannelName)}>
            <option value="email">{tChannel('email')}</option>
            <option value="whatsapp">{tChannel('whatsapp')}</option>
            <option value="telegram">{tChannel('telegram')}</option>
          </select>
        </label>
        <label>
          {t('memberContact')}
          <input type="text" value={memberContact} onChange={(e) => setMemberContact(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? t('addMemberSubmitLoading') : t('addMemberSubmit')}
        </button>
      </form>
      </div>
      <button type="button" onClick={() => router.push('/app')}>
        {t('finish')}
      </button>
    </main>
  );
}
