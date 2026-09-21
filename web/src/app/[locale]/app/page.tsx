'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, Report, Team } from '@/lib/api';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const tNav = useTranslations('Nav');
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(() => api.listTeams())
      .then((t) => {
        setTeams(t);
        if (t.length > 0) setSelectedTeamId(t[0].id);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push('/login');
        } else {
          setError(t('loadError'));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!selectedTeamId) return;
    api
      .listReports(selectedTeamId)
      .then(setReports)
      .catch(() => setError(t('reportsLoadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  async function handleLogout() {
    await api.logout();
    router.push('/login');
  }

  if (error) return <main className="page"><p role="alert">{error}</p></main>;
  if (teams === null) return <main className="page"><p>{t('loading')}</p></main>;

  if (teams.length === 0) {
    return (
      <main className="page">
        <h1>{t('title')}</h1>
        <div className="card">
          <p>{t('noTeams')}</p>
          <Link className="btn btn-primary" href="/app/onboarding">{t('createFirstTeam')}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{t('title')}</h1>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <LocaleSwitcher />
          <button type="button" onClick={handleLogout}>
            {tNav('logout')}
          </button>
        </div>
      </div>

      <label>
        {t('teamLabel')}
        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <h2>{t('historyTitle')}</h2>
      {reports.length === 0 && <p>{t('noReports')}</p>}
      <ul className="report-list">
        {reports.map((r) => (
          <li key={r.id}>
            <strong>{t('weekOf', { date: r.week_start })}</strong>
            <pre>{r.content_markdown ?? t('reportPending')}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
