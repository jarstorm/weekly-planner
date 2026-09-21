'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Circle, Download, FileText, Users } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, CheckinStatus, Report, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

// Lunes de "esta semana" en el navegador del que mira el panel — solo para
// el widget de estado en vivo. La fuente de verdad para semanas pasadas es
// siempre report.week_start, calculado en el backend con el timezone del
// equipo (ver api/src/jobs/date.utils.ts).
function mondayOfThisWeek(): string {
  const now = new Date();
  const dow = now.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function ResponseStatusList({ status }: { status: CheckinStatus[] }) {
  const t = useTranslations('Dashboard');
  if (status.length === 0) return null;
  return (
    <ul className="member-status-list">
      {status.map((s) => (
        <li key={s.memberId} className={s.responded ? 'responded' : 'not-responded'}>
          {s.responded ? <CheckCircle2 size={14} /> : <Circle size={14} />}
          {s.memberName}
          {!s.responded && <span className="muted-link"> · {t('notResponded')}</span>}
        </li>
      ))}
    </ul>
  );
}

function ResponseRate({ status }: { status: CheckinStatus[] }) {
  const t = useTranslations('Dashboard');
  if (status.length === 0) return null;
  const responded = status.filter((s) => s.responded).length;
  const pct = Math.round((responded / status.length) * 100);
  return (
    <>
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon"><Users size={18} /></span>
          <div>
            <div className="stat-value">{status.length}</div>
            <div className="stat-label">{t('statMembers')}</div>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><CheckCircle2 size={18} /></span>
          <div>
            <div className="stat-value">{responded}</div>
            <div className="stat-label">{t('statResponded')}</div>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><Circle size={18} /></span>
          <div>
            <div className="stat-value">{status.length - responded}</div>
            <div className="stat-label">{t('statPending')}</div>
          </div>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [reports, setReports] = useState<Report[]>([]);
  const [statusByWeek, setStatusByWeek] = useState<Record<string, CheckinStatus[]>>({});
  const [currentWeekStatus, setCurrentWeekStatus] = useState<CheckinStatus[]>([]);
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
      .then((rs) => {
        setReports(rs);
        Promise.all(rs.map((r) => api.checkinStatus(selectedTeamId, r.week_start).then((s) => [r.week_start, s] as const)))
          .then((entries) => setStatusByWeek(Object.fromEntries(entries)))
          .catch(() => {
            /* el estado de respuestas es un plus, no bloquea ver el informe */
          });
      })
      .catch(() => setError(t('reportsLoadError')));

    const thisWeek = mondayOfThisWeek();
    api
      .checkinStatus(selectedTeamId, thisWeek)
      .then(setCurrentWeekStatus)
      .catch(() => setCurrentWeekStatus([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  if (error) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (teams === null) {
    return (
      <AppShell>
        <p>{t('loading')}</p>
      </AppShell>
    );
  }

  if (teams.length === 0) {
    return (
      <AppShell>
        <h1>{t('title')}</h1>
        <div className="card">
          <p>{t('noTeams')}</p>
          <Link className="btn btn-primary" href="/app/onboarding">{t('createFirstTeam')}</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{t('title')}</h1>
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

      <h2>{t('currentWeekTitle')}</h2>
      <ResponseRate status={currentWeekStatus} />
      <div className="card">
        <ResponseStatusList status={currentWeekStatus} />
        {currentWeekStatus.length === 0 && <p>{t('noMembers')}</p>}
        <a className="btn btn-secondary" href={api.conversationsExportUrl(selectedTeamId)}>
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
                <a className="btn btn-secondary" href={api.conversationsExportUrl(selectedTeamId, r.week_start)}>
                  <Download size={15} />
                  {t('downloadConversations')}
                </a>
              </div>
            </div>
            <ResponseStatusList status={statusByWeek[r.week_start] ?? []} />
            <pre>{r.content_markdown ?? t('reportPending')}</pre>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
