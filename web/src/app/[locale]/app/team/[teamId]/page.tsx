'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Download, FileText, Settings, UsersRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, CheckinStatus, Report, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { ResponsePercent, ResponseRate, ResponseStatusList, mondayOfThisWeek } from '@/components/ResponseStatus';

export default function TeamDashboardPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId ?? '';
  const t = useTranslations('Dashboard');

  const [team, setTeam] = useState<Team | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [statusByWeek, setStatusByWeek] = useState<Record<string, CheckinStatus[]>>({});
  const [currentWeekStatus, setCurrentWeekStatus] = useState<CheckinStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    api.getTeam(teamId).then(setTeam).catch(() => setError(t('loadError')));

    api
      .listReports(teamId)
      .then((rs) => {
        setReports(rs);
        Promise.all(rs.map((r) => api.checkinStatus(teamId, r.week_start).then((s) => [r.week_start, s] as const)))
          .then((entries) => setStatusByWeek(Object.fromEntries(entries)))
          .catch(() => {
            /* el estado de respuestas es un plus, no bloquea ver el informe */
          });
      })
      .catch(() => setError(t('reportsLoadError')));

    api
      .checkinStatus(teamId, mondayOfThisWeek())
      .then(setCurrentWeekStatus)
      .catch(() => setCurrentWeekStatus([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

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
        <p>{t('loading')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{team.name}</h1>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <Link className="btn btn-secondary" href={`/app/team/${teamId}/edit`}>
            <Settings size={15} />
            {t('editTeam')}
          </Link>
          <Link className="btn btn-secondary" href={`/app/team/${teamId}/members`}>
            <UsersRound size={15} />
            {t('manageMembers')}
          </Link>
        </div>
      </div>

      <h2>{t('currentWeekTitle')}</h2>
      <ResponseRate status={currentWeekStatus} />
      <div className="card">
        <ResponseStatusList status={currentWeekStatus} />
        {currentWeekStatus.length === 0 && <p>{t('noMembers')}</p>}
        <a className="btn btn-secondary" href={api.conversationsExportUrl(teamId)}>
          <Download size={16} />
          {t('downloadAllConversations')}
        </a>
      </div>

      <h2>{t('historyTitle')}</h2>
      {reports.length === 0 && <p>{t('noReports')}</p>}
      <ul className="report-list">
        {reports.map((r) => (
          <li key={r.id}>
            <div className="topbar" style={{ marginBottom: '0.5rem' }}>
              <strong>{t('weekOf', { date: r.week_start })}</strong>
              <div className="hero-actions" style={{ marginTop: 0 }}>
                <a className="btn btn-secondary" href={api.reportPdfUrl(r.id)}>
                  <FileText size={15} />
                  {t('downloadPdf')}
                </a>
                <a className="btn btn-secondary" href={api.conversationsExportUrl(teamId, r.week_start)}>
                  <Download size={15} />
                  {t('downloadConversations')}
                </a>
              </div>
            </div>
            <ResponsePercent status={statusByWeek[r.week_start] ?? []} />
            <ResponseStatusList status={statusByWeek[r.week_start] ?? []} />
            <pre>{r.content_markdown ?? t('reportPending')}</pre>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
