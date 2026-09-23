'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError, ChannelName, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations('Onboarding');
  const tChannel = useTranslations('Channel');
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // datos del equipo
  const [name, setName] = useState('');
  const [companyContext, setCompanyContext] = useState('');

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
      const created = await api.createTeam({ name, company_context: companyContext });
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
      // Telegram se vincula después, desde la pantalla de miembros del
      // equipo (deep link con el bot) — acá no se pide chat_id a mano.
      await api.addMember(
        team.id,
        memberChannel === 'telegram'
          ? { name: memberName, channel: memberChannel }
          : { name: memberName, channel: memberChannel, contact: memberContact },
      );
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
      <AppShell>
        <h1>{t('createTeamTitle')}</h1>
        <p className="muted-link">
          {t('feedbackConfigNote')} <Link href="/app/feedback">{t('feedbackConfigLink')}</Link>.
        </p>
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
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? t('createTeamSubmitLoading') : t('createTeamSubmit')}
            </button>
          </form>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1>{t('membersTitle', { teamName: team.name })}</h1>
      <div className="card">
      {members.length > 0 && (
        <ul className="member-list">
          {members.map((m, i) => (
            <li key={i}>
              <CheckCircle2 size={14} /> {m}
            </li>
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
            <option value="telegram">{tChannel('telegram')}</option>
          </select>
        </label>
        {memberChannel === 'telegram' ? (
          <p className="field-hint">{t('telegramLinkAfterCreate')}</p>
        ) : (
          <label>
            {t('memberContact')}
            <input
              type="text"
              placeholder={t('memberContactEmailPlaceholder')}
              value={memberContact}
              onChange={(e) => setMemberContact(e.target.value)}
              required
            />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? t('addMemberSubmitLoading') : t('addMemberSubmit')}
        </button>
      </form>
      </div>
      <button type="button" onClick={() => router.push('/app')}>
        {t('finish')}
      </button>
    </AppShell>
  );
}
