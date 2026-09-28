'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, FileText, Mail, Plus, Users, UsersRound } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, ChannelName, CheckinStatus, Member, Organization, Report, Team } from '@/lib/api';
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
  const tDay = useTranslations('Day');
  const tChannel = useTranslations('Channel');
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [statsByTeam, setStatsByTeam] = useState<Record<string, TeamStats>>({});
  const [org, setOrg] = useState<Organization | null>(null);
  const [executiveSummaries, setExecutiveSummaries] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Se espera a que org también haya resuelto (éxito o error) antes de
  // salir del skeleton — si no, el primer paint real llega con org todavía
  // en null y cosas como la card "Nuevo equipo" (depende de max_teams) se
  // muestran de más y desaparecen de golpe en cuanto org llega.
  const [orgSettled, setOrgSettled] = useState(false);

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
        api
          .getOrganization()
          .then((o) => {
            setOrg(o);
            if (o.has_executive_summary) {
              api
                .listExecutiveSummaries()
                .then(setExecutiveSummaries)
                .catch(() => {
                  /* la sección de resumen ejecutivo es un plus, no bloquea el resto */
                });
            }
          })
          .catch(() => {
            /* el banner de horario es un plus, no bloquea ver los equipos */
          })
          .finally(() => setOrgSettled(true));
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
  const statsLoaded = teams !== null && (teams.length === 0 || Object.keys(statsByTeam).length === teams.length);

  if (teams === null || !orgSettled || !statsLoaded) {
    return (
      <AppShell>
        <DashboardSkeleton />
      </AppShell>
    );
  }
  const totalMembers = Object.values(statsByTeam).reduce((sum, s) => sum + s.members.length, 0);
  const membersByChannel = Object.values(statsByTeam).reduce(
    (acc, s) => {
      s.members.forEach((m) => {
        acc[m.channel] = (acc[m.channel] ?? 0) + 1;
      });
      return acc;
    },
    { email: 0, whatsapp: 0, telegram: 0 } as Record<ChannelName, number>,
  );
  const totalReports = Object.values(statsByTeam).reduce((sum, s) => sum + s.reports.length, 0);
  const weekTotal = Object.values(statsByTeam).reduce((sum, s) => sum + s.weekStatus.length, 0);
  const weekResponded = Object.values(statsByTeam).reduce(
    (sum, s) => sum + s.weekStatus.filter((m) => m.responded).length,
    0,
  );
  const weekPct = weekTotal > 0 ? Math.round((weekResponded / weekTotal) * 100) : null;

  const noRecipientsAnywhere = teams.length > 0 && teams.every((team) => team.report_recipients.length === 0);

  const atTeamLimit = org != null && org.max_teams !== null && teams.length >= org.max_teams;

  return (
    <AppShell>
      {noRecipientsAnywhere && (
        <div className="schedule-banner schedule-banner-unset">
          <span className="stat-icon"><AlertTriangle size={18} /></span>
          <div className="schedule-banner-body">
            <span className="muted-link">{t('noRecipientsWarning')}</span>
          </div>
        </div>
      )}

      {teams.length > 0 && statsLoaded && (
        <>
          <h2 className="dashboard-section-title">{t('statsTitle')}</h2>
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
        </>
      )}

      {(org || (teams.length > 0 && statsLoaded)) && (
        <div className="dashboard-two-col">
          {org && (
            <div>
              <h2 className="dashboard-section-title">{t('scheduleBannerTitle')}</h2>
              <Link href="/app/feedback" className="schedule-banner">
                <span className="stat-icon"><Clock size={18} /></span>
                <div className="schedule-banner-body">
                  <span className="muted-link">
                    {t('scheduleReminderSummary', {
                      day: tDay(String(org.reminder_dow)),
                      time: org.reminder_time.slice(0, 5),
                    })}
                  </span>
                  <span className="muted-link">
                    {t('scheduleReportSummary', {
                      day: tDay(String(org.reminder_dow)),
                      time: org.cutoff_time.slice(0, 5),
                    })}
                  </span>
                </div>
                <ChevronRight size={18} className="schedule-banner-chevron" />
              </Link>
            </div>
          )}

          {teams.length > 0 && statsLoaded && (
            <div>
              <h2 className="dashboard-section-title">{t('statMembersByChannel')}</h2>
              <div className="stat-card stat-card-channels">
                <div className="stat-channels-list">
                  <span><Mail size={14} /> {tChannel('email')} <strong>{membersByChannel.email}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <h2 className="dashboard-section-title">{t('teamsTitle')}</h2>

      {teams.length === 0 && (
        <div className="card">
          <p>{t('noTeams')}</p>
          <Link className="btn btn-primary" href="/app/onboarding">{t('createFirstTeam')}</Link>
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

        {teams.length > 0 && !atTeamLimit && (
          <Link href="/app/onboarding" className="team-card team-card-new">
            <span className="stat-icon"><Plus size={18} /></span>
            <strong>{tNav('newTeam')}</strong>
          </Link>
        )}
      </div>

      {org?.has_executive_summary && (
        <>
          <h2 className="dashboard-section-title">{t('executiveSummaryTitle')}</h2>
          <div className="card">
            {executiveSummaries.length === 0 ? (
              <p className="muted-link">{t('executiveSummaryNoReports')}</p>
            ) : (
              <ul className="report-list">
                {executiveSummaries.map((r) => (
                  <li key={r.id}>
                    <div className="topbar" style={{ marginBottom: 0 }}>
                      <strong>{t('executiveSummaryWeekOf', { date: r.week_start })}</strong>
                      <a className="btn btn-secondary" href={api.reportPdfUrl(r.id)}>
                        <FileText size={15} />
                        {t('downloadPdf')}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
