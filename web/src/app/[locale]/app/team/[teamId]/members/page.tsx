'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, Member, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

export default function TeamMembersPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    api.getTeam(teamId).then(setTeam).catch(() => setError(t('loadTeamError')));
    api
      .listMembers(teamId)
      .then(setMembers)
      .catch(() => setError(t('loadMembersError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function handleRemoveMember(memberId: string) {
    setError(null);
    try {
      await api.removeMember(teamId, memberId);
      setMembers((prev) => prev!.filter((m) => m.id !== memberId));
    } catch {
      setError(t('removeMemberError'));
    }
  }

  if (!team || members === null) {
    return <AppShell>{error ? <p role="alert">{error}</p> : <FormSkeleton rows={3} />}</AppShell>;
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}`} className="back-link">
        <ArrowLeft size={16} />
        {team.name}
      </Link>
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{t('membersTitle')}</h1>
        <Link className="btn btn-primary" href={`/app/team/${teamId}/members/new`}>
          <UserPlus size={16} />
          {t('addMember')}
        </Link>
      </div>
      <div className="card">
        {error && <p role="alert">{error}</p>}

        <ul className="member-edit-list">
          {members.map((m) => (
            <li key={m.id} className="member-edit-row">
              <span>{m.name}</span>
              <span className="muted-link">{tChannel(m.channel)}</span>
              <span className="muted-link">{m.contact ?? t('telegramNotLinked')}</span>
              <Link className="btn-ghost" href={`/app/team/${teamId}/members/${m.id}/edit`}>
                <Pencil size={15} />
              </Link>
              <button type="button" className="btn-ghost" onClick={() => handleRemoveMember(m.id)}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {members.length === 0 && <p>{t('noMembersYet')}</p>}
        </ul>
      </div>
    </AppShell>
  );
}
