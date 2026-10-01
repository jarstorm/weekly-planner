'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, MailQuestion, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, Member, Team } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { formatWhatsappContact } from '@/lib/whatsappCountries';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function TeamMembersPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    api.getTeam(teamId).then(setTeam).catch(() => setError(t('loadTeamError')));
    api
      .listMembers(teamId)
      .then(setMembers)
      .catch(() => setError(t('loadMembersError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function confirmRemove() {
    if (!removing) return;
    setError(null);
    try {
      await api.removeMember(teamId, removing.id);
      setMembers((prev) => (prev ? prev.filter((m) => m.id !== removing.id) : prev));
      trackEvent('member_remove');
    } catch {
      setError(t('removeMemberError'));
    } finally {
      setRemoving(null);
    }
  }

  async function resendVerification(memberId: string) {
    setError(null);
    setResendingId(memberId);
    try {
      await api.resendMemberVerification(teamId, memberId);
      setResentId(memberId);
    } catch {
      setError(t('resendVerificationError'));
    } finally {
      setResendingId(null);
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

      {error && <p role="alert">{error}</p>}

      {members.length === 0 ? (
        <div className="card">
          <p>{t('noMembersYet')}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('memberName')}</th>
                <th>{t('memberChannel')}</th>
                <th>{t('memberContact')}</th>
                <th className="data-table-actions-header">{t('columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="muted-link">{tChannel(m.channel)}</td>
                  <td className="muted-link">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      {m.contact
                        ? m.channel === 'whatsapp'
                          ? formatWhatsappContact(m.contact)
                          : m.contact
                        : t('telegramNotLinked')}
                      {m.channel === 'email' && m.contact && (
                        m.email_verified_at ? (
                          <span title={t('emailVerified')}>
                            <CheckCircle2 size={14} color="var(--color-brand)" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.1rem 0.3rem' }}
                            disabled={resendingId === m.id}
                            title={t('resendVerification')}
                            onClick={() => resendVerification(m.id)}
                          >
                            <MailQuestion size={14} />
                            {resentId === m.id ? t('verificationResent') : t('resendVerification')}
                          </button>
                        )
                      )}
                    </span>
                  </td>
                  <td className="data-table-actions">
                    <Link className="btn-ghost" href={`/app/team/${teamId}/members/${m.id}/edit`}>
                      <Pencil size={15} />
                    </Link>
                    <button type="button" className="btn-ghost" onClick={() => setRemoving(m)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t('removeConfirmTitle', { name: removing?.name ?? '' })}
        message={t('removeConfirmMessage')}
        cancelLabel={t('removeConfirmCancel')}
        confirmLabel={t('removeConfirmConfirm')}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </AppShell>
  );
}
