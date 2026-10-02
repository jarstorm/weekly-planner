'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronRight, FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, Report, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { FormSkeleton } from '@/components/Skeleton';

interface ReportRow extends Report {
  label: string;
}

// Dashboard de informes (pedido explícito): el listado agregado de todos
// los informes ya generados, de todos los equipos a la vez — antes solo
// se podían ver equipo por equipo en /app/team/[teamId]. Planificar
// cuándo se generan es otra pantalla aparte, a la que se llega por la
// card de abajo (/app/reports/schedule), no un formulario inline acá.
export default function ReportsPage() {
  const t = useTranslations('Reports');
  const tDash = useTranslations('Dashboard');

  const [teams, setTeams] = useState<Team[] | null>(null);
  const [reportsByTeam, setReportsByTeam] = useState<Record<string, Report[]>>({});
  const [executiveSummaries, setExecutiveSummaries] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTeams()
      .then((ts) => {
        setTeams(ts);
        Promise.all(ts.map((team) => api.listReports(team.id).then((rs) => [team.id, rs] as const)))
          .then((entries) => setReportsByTeam(Object.fromEntries(entries)))
          .catch(() => {
            /* el listado de informes es un plus, no bloquea el resto */
          });
      })
      .catch(() => setError(t('loadError')));

    api
      .listExecutiveSummaries()
      .then(setExecutiveSummaries)
      .catch(() => {
        /* sin resumen ejecutivo activado, el endpoint puede no devolver nada útil */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allReports: ReportRow[] = [
    ...(teams ?? []).flatMap((team) => (reportsByTeam[team.id] ?? []).map((r) => ({ ...r, label: team.name }))),
    ...executiveSummaries.map((r) => ({ ...r, label: t('executiveSummaryLabel') })),
  ].sort((a, b) => b.week_start.localeCompare(a.week_start));

  return (
    <AppShell>
      <h1>{t('title')}</h1>
      <p className="muted-link">{t('description')}</p>

      {error && <p role="alert">{error}</p>}

      <Link href="/app/reports/schedule" className="schedule-banner">
        <span className="stat-icon">
          <Calendar size={18} />
        </span>
        <div className="schedule-banner-body">
          <span className="muted-link">{t('scheduleCardTitle')}</span>
          <span className="muted-link">{t('scheduleCardDescription')}</span>
        </div>
        <ChevronRight size={18} className="schedule-banner-chevron" />
      </Link>

      <h2 className="dashboard-section-title">{t('generatedTitle')}</h2>
      {teams === null ? (
        <FormSkeleton rows={3} />
      ) : allReports.length === 0 ? (
        <div className="card">
          <p className="muted-link">{t('noGeneratedYet')}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('columnTeam')}</th>
                <th>{t('columnWeek')}</th>
                <th className="data-table-actions-header">{t('columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {allReports.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="muted-link">{r.week_start}</td>
                  <td className="data-table-actions">
                    <a className="btn-ghost" href={api.reportPdfUrl(r.id)}>
                      <FileText size={15} />
                      {tDash('downloadPdf')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
