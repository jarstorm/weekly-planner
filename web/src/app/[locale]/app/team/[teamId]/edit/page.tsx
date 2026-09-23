'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';
import { RecipientsEditor } from '@/components/RecipientsEditor';

export default function EditTeamPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const router = useRouter();
  const t = useTranslations('TeamManager');

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
        <FormSkeleton rows={2} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}`} className="back-link">
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
            {t('reportRecipients')}
            <RecipientsEditor
              recipients={team.report_recipients}
              onChange={(report_recipients) => setTeam({ ...team, report_recipients })}
              placeholder={t('reportRecipientsPlaceholder')}
              addLabel={t('reportRecipientsAdd')}
              emptyHint={t('reportRecipientsEmpty')}
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
