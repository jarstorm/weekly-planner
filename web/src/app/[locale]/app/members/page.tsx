'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Mail, MailQuestion, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, OrgMember } from '@/lib/api';
import { formatWhatsappContact } from '@/lib/whatsappCountries';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const CHANNEL_ICON = {
  email: Mail,
  whatsapp: MessageCircle,
  telegram: Send,
} as const;

// Listado de toda la cuenta, de todos los equipos a la vez — nombre, equipo
// y canal por el que recibe el feedback, con filtro por nombre/equipo y
// las mismas acciones de editar/borrar que la ficha de equipo (pedido
// explícito). El borrado sigue siendo soft delete (TeamsService.removeMember
// pone active=false) — coherente con que este listado ya solo trae activos.
export default function AllMembersPage() {
  const t = useTranslations('AllMembers');
  const tTeamManager = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');

  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [removing, setRemoving] = useState<OrgMember | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);

  useEffect(() => {
    api.listAllMembers().then(setMembers).catch(() => setError(t('loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (members ?? []).forEach((m) => seen.set(m.team_id, m.team_name));
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  const filtered = (members ?? []).filter((m) => {
    if (teamFilter && m.team_id !== teamFilter) return false;
    if (nameFilter && !m.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  async function confirmRemove() {
    if (!removing) return;
    setError(null);
    try {
      await api.removeMember(removing.team_id, removing.id);
      setMembers((prev) => (prev ? prev.filter((m) => m.id !== removing.id) : prev));
    } catch {
      setError(t('removeError'));
    } finally {
      setRemoving(null);
    }
  }

  async function resendVerification(m: OrgMember) {
    setError(null);
    setResendingId(m.id);
    try {
      await api.resendMemberVerification(m.team_id, m.id);
      setResentId(m.id);
    } catch {
      setError(tTeamManager('resendVerificationError'));
    } finally {
      setResendingId(null);
    }
  }

  if (error && !members) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (!members) {
    return (
      <AppShell>
        <FormSkeleton rows={4} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>

      {error && <p role="alert">{error}</p>}

      {members.length === 0 ? (
        <div className="card">
          <p>{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="data-table-filters">
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder={t('filterNamePlaceholder')}
            />
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">{t('filterTeamAll')}</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('columnName')}</th>
                  <th>{t('columnTeam')}</th>
                  <th>{t('columnChannel')}</th>
                  <th>{t('columnContact')}</th>
                  <th className="data-table-actions-header">{t('columnActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const ChannelIcon = CHANNEL_ICON[m.channel];
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>
                        <Link className="muted-link" href={`/app/team/${m.team_id}`}>
                          {m.team_name}
                        </Link>
                      </td>
                      <td className="muted-link">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <ChannelIcon size={14} /> {tChannel(m.channel)}
                        </span>
                      </td>
                      <td className="muted-link">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          {m.contact
                            ? m.channel === 'whatsapp'
                              ? formatWhatsappContact(m.contact)
                              : m.contact
                            : tTeamManager('telegramNotLinked')}
                          {m.channel === 'email' && m.contact && (
                            m.email_verified_at ? (
                              <span title={tTeamManager('emailVerified')}>
                                <CheckCircle2 size={14} color="var(--color-brand)" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ padding: '0.1rem 0.3rem' }}
                                disabled={resendingId === m.id}
                                title={tTeamManager('resendVerification')}
                                onClick={() => resendVerification(m)}
                              >
                                <MailQuestion size={14} />
                                {resentId === m.id ? tTeamManager('verificationResent') : tTeamManager('resendVerification')}
                              </button>
                            )
                          )}
                        </span>
                      </td>
                      <td className="data-table-actions">
                        <Link className="btn-ghost" href={`/app/team/${m.team_id}/members/${m.id}/edit`}>
                          <Pencil size={15} />
                        </Link>
                        <button type="button" className="btn-ghost" onClick={() => setRemoving(m)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted-link">
                      {t('noMatches')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={tTeamManager('removeConfirmTitle', { name: removing?.name ?? '' })}
        message={tTeamManager('removeConfirmMessage')}
        cancelLabel={tTeamManager('removeConfirmCancel')}
        confirmLabel={tTeamManager('removeConfirmConfirm')}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </AppShell>
  );
}
