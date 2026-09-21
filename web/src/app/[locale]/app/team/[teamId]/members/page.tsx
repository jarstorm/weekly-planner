'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, ChannelName, Member, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

export default function TeamMembersPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const t = useTranslations('TeamManager');
  const tChannel = useTranslations('Channel');

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; channel: ChannelName; contact: string }>({
    name: '',
    channel: 'email',
    contact: '',
  });

  const [newName, setNewName] = useState('');
  const [newChannel, setNewChannel] = useState<ChannelName>('email');
  const [newContact, setNewContact] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    api.getTeam(teamId).then(setTeam).catch(() => setError(t('loadTeamError')));
    api
      .listMembers(teamId)
      .then(setMembers)
      .catch(() => setError(t('loadMembersError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditDraft({ name: m.name, channel: m.channel, contact: m.contact });
  }

  async function handleSaveMember(memberId: string) {
    setError(null);
    try {
      const updated = await api.updateMember(teamId, memberId, editDraft);
      setMembers((prev) => prev!.map((m) => (m.id === memberId ? updated : m)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveMemberError'));
    }
  }

  async function handleRemoveMember(memberId: string) {
    setError(null);
    try {
      await api.removeMember(teamId, memberId);
      setMembers((prev) => prev!.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('removeMemberError'));
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setError(null);
    try {
      const created = await api.addMember(teamId, { name: newName, channel: newChannel, contact: newContact });
      setMembers((prev) => [...(prev ?? []), created]);
      setNewName('');
      setNewContact('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('addMemberError'));
    } finally {
      setAddLoading(false);
    }
  }

  if (!team || members === null) {
    return (
      <AppShell>
        {error ? <p role="alert">{error}</p> : <p>{t('loading')}</p>}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}`} className="btn-ghost" style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} />
        {team.name}
      </Link>
      <h1>{t('membersTitle')}</h1>
      <div className="card">
        {error && <p role="alert">{error}</p>}

        <ul className="member-edit-list">
          {members.map((m) =>
            editingId === m.id ? (
              <li key={m.id} className="member-edit-row">
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                />
                <select
                  value={editDraft.channel}
                  onChange={(e) => setEditDraft({ ...editDraft, channel: e.target.value as ChannelName })}
                >
                  <option value="email">{tChannel('email')}</option>
                  <option value="whatsapp">{tChannel('whatsapp')}</option>
                  <option value="telegram">{tChannel('telegram')}</option>
                </select>
                <input
                  type="text"
                  value={editDraft.contact}
                  onChange={(e) => setEditDraft({ ...editDraft, contact: e.target.value })}
                />
                <button type="button" className="btn-ghost" onClick={() => handleSaveMember(m.id)}>
                  {t('save')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                  <X size={16} />
                </button>
              </li>
            ) : (
              <li key={m.id} className="member-edit-row">
                <span>{m.name}</span>
                <span className="muted-link">{tChannel(m.channel)}</span>
                <span className="muted-link">{m.contact}</span>
                <button type="button" className="btn-ghost" onClick={() => startEdit(m)}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="btn-ghost" onClick={() => handleRemoveMember(m.id)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ),
          )}
          {members.length === 0 && <p>{t('noMembersYet')}</p>}
        </ul>

        <form onSubmit={handleAddMember} className="member-add-form">
          <input
            type="text"
            placeholder={t('memberName')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <select value={newChannel} onChange={(e) => setNewChannel(e.target.value as ChannelName)}>
            <option value="email">{tChannel('email')}</option>
            <option value="whatsapp">{tChannel('whatsapp')}</option>
            <option value="telegram">{tChannel('telegram')}</option>
          </select>
          <input
            type="text"
            placeholder={t('memberContact')}
            value={newContact}
            onChange={(e) => setNewContact(e.target.value)}
            required
          />
          <button type="submit" disabled={addLoading}>
            <UserPlus size={16} />
            {addLoading ? t('adding') : t('addMember')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
