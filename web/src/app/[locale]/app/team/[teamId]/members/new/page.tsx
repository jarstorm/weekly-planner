'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError, ChannelName } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { useEnabledChannels } from '@/lib/useEnabledChannels';
import { AppShell } from '@/components/AppShell';
import { ContactInput } from '@/components/ContactInput';

export default function NewMemberPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const router = useRouter();
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');
  const enabledChannels = useEnabledChannels();

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
      trackEvent('member_add', { channel, context: 'team' });
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
              {enabledChannels.whatsapp && <option value="whatsapp">{tChannel('whatsapp')}</option>}
            </select>
          </label>
          <label>
            {t('memberContact')}
            <ContactInput channel={channel} contact={contact} onChange={setContact} />
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
