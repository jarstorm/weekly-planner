'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError, ChannelName, Member } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

export default function EditMemberPage() {
  const params = useParams<{ teamId: string; memberId: string }>();
  const teamId = params?.teamId ?? '';
  const memberId = params?.memberId ?? '';
  const router = useRouter();
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');

  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId || !memberId) return;
    api
      .listMembers(teamId)
      .then((members) => {
        const found = members.find((m) => m.id === memberId);
        if (!found) {
          setError(t('notFound'));
          return;
        }
        setMember(found);
      })
      .catch(() => setError(t('loadMembersError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, memberId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateMember(teamId, memberId, {
        name: member.name,
        channel: member.channel,
        contact: member.contact,
      });
      router.push(`/app/team/${teamId}/members`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveMemberError'));
    } finally {
      setSaving(false);
    }
  }

  if (error && !member) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (!member) {
    return (
      <AppShell>
        <FormSkeleton rows={3} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}/members`} className="back-link">
        <ArrowLeft size={16} />
        {t('membersTitle')}
      </Link>
      <h1>{t('editMemberTitle')}</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            {t('memberName')}
            <input
              type="text"
              value={member.name}
              onChange={(e) => setMember({ ...member, name: e.target.value })}
              required
            />
          </label>
          <label>
            {t('memberChannel')}
            <select
              value={member.channel}
              onChange={(e) => setMember({ ...member, channel: e.target.value as ChannelName })}
            >
              <option value="email">{tChannel('email')}</option>
              <option value="telegram">{tChannel('telegram')}</option>
            </select>
          </label>
          {member.channel === 'telegram' && (
            <a className="muted-link" href="/help/telegram" target="_blank" rel="noopener noreferrer">
              {t('telegramHelpLink')}
            </a>
          )}
          <label>
            {t('memberContact')}
            <input
              type="text"
              placeholder={
                member.channel === 'telegram' ? t('memberContactTelegramPlaceholder') : t('memberContactEmailPlaceholder')
              }
              value={member.contact}
              onChange={(e) => setMember({ ...member, contact: e.target.value })}
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
