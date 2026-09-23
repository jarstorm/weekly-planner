'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, FileText, Users, UsersRound } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, CheckinStatus, Member, Report, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { mondayOfThisWeek } from '@/components/ResponseStatus';
import { DashboardSkeleton } from '@/components/Skeleton';

interface TeamStats {
  members: Member[];
  reports: Report[];
  weekStatus: CheckinStatus[];
}

// Selector de equipos como cards, cada una lleva a su propia página
// (/app/team/[teamId]) — pedido explícito, antes era un <select> con todo
// (estado + histórico) apilado debajo en la misma página.
export default function TeamsPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const tNav = useTranslations('Nav');
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [statsByTeam, setStatsByTeam] = useState<Record<string, TeamStats>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(() => api.listTeams())
      .then((ts) => {
        setTeams(ts);
        const weekStart = mondayOfThisWeek();
        Promise.all(
          ts.map((team) =>
            Promise.all([api.listMembers(team.id), api.listReports(team.id), api.checkinStatus(team.id, weekStart)]).then(
              ([members, reports, weekStatus]) => [team.id, { members, reports, weekStatus }] as const,
            ),
          ),
        )
          .then((entries) => setStatsByTeam(Object.fromEntries(entries)))
          .catch(() => {
            /* las estadísticas del panel son un plus, no bloquean ver los equipos */
          });
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
        <DashboardSkeleton />
      </AppShell>
    );
  }

  const statsLoaded = teams.length === 0 || Object.keys(statsByTeam).length === teams.length;
  const totalMembers = Object.values(statsByTeam).reduce((sum, s) => sum + s.members.length, 0);
  const totalReports = Object.values(statsByTeam).reduce((sum, s) => sum + s.reports.length, 0);
  const weekTotal = Object.values(statsByTeam).reduce((sum, s) => sum + s.weekStatus.length, 0);
  const weekResponded = Object.values(statsByTeam).reduce(
    (sum, s) => sum + s.weekStatus.filter((m) => m.responded).length,
    0,
  );
  const weekPct = weekTotal > 0 ? Math.round((weekResponded / weekTotal) * 100) : null;

  return (
    <AppShell>
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{t('title')}</h1>
        {teams.length > 0 && (
          <Link className="btn btn-primary" href="/app/onboarding">{tNav('newTeam')}</Link>
        )}
      </div>

      {teams.length === 0 && (
        <div className="card">
          <p>{t('noTeams')}</p>
          <Link className="btn btn-primary" href="/app/onboarding">{t('createFirstTeam')}</Link>
        </div>
      )}

      {teams.length > 0 && statsLoaded && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon"><UsersRound size={18} /></span>
            <div>
              <div className="stat-value">{teams.length}</div>
              <div className="stat-label">{t('statTeams')}</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon"><Users size={18} /></span>
            <div>
              <div className="stat-value">{totalMembers}</div>
              <div className="stat-label">{t('statTotalMembers')}</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon"><FileText size={18} /></span>
            <div>
              <div className="stat-value">{totalReports}</div>
              <div className="stat-label">{t('statReports')}</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon"><CheckCircle2 size={18} /></span>
            <div>
              <div className="stat-value">{weekPct !== null ? `${weekPct}%` : '—'}</div>
              <div className="stat-label">{t('statAvgResponse')}</div>
            </div>
          </div>
        </div>
      )}

      <div className="team-card-grid">
        {teams.map((team) => {
          const stats = statsByTeam[team.id];
          const latestReport = stats?.reports[0] ?? null;
          return (
            <Link key={team.id} href={`/app/team/${team.id}`} className="team-card">
              <span className="stat-icon"><Users size={18} /></span>
              <strong>{team.name}</strong>
              {stats && (
                <span className="muted-link">
                  {t('cardMembers', { count: stats.members.length })}
                  {stats.weekStatus.length > 0 &&
                    ` · ${t('cardResponseThisWeek', {
                      responded: stats.weekStatus.filter((m) => m.responded).length,
                      total: stats.weekStatus.length,
                    })}`}
                </span>
              )}
              <span className="team-card-report">
                {latestReport ? (
                  <a
                    className="muted-link"
                    href={api.reportPdfUrl(latestReport.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText size={14} />
                    {t('cardLastReport', { date: latestReport.week_start })}
                  </a>
                ) : (
                  stats && <span className="muted-link">{t('cardNoReports')}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
