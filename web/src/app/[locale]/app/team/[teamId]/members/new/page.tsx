'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError, ChannelName } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

export default function NewMemberPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const router = useRouter();
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ChannelName>('email');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.addMember(teamId, { name, channel, contact });
      router.push(`/app/team/${teamId}/members`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('addMemberError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}/members`} className="back-link">
        <ArrowLeft size={16} />
        {t('membersTitle')}
      </Link>
      <h1>{t('addMemberTitle')}</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            {t('memberName')}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t('memberChannel')}
            <select value={channel} onChange={(e) => setChannel(e.target.value as ChannelName)}>
              <option value="email">{tChannel('email')}</option>
              <option value="telegram">{tChannel('telegram')}</option>
            </select>
          </label>
          <label>
            {t('memberContact')}
            <input
              type="text"
              placeholder={channel === 'telegram' ? t('memberContactTelegramPlaceholder') : t('memberContactEmailPlaceholder')}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={saving}>
            <UserPlus size={16} />
            {saving ? t('adding') : t('addMember')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
