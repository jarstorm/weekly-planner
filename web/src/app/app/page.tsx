'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, Report, Team } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
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
          setError('No se pudo cargar el panel');
        }
      });
  }, [router]);

  useEffect(() => {
    if (!selectedTeamId) return;
    api
      .listReports(selectedTeamId)
      .then(setReports)
      .catch(() => setError('No se pudieron cargar los informes'));
  }, [selectedTeamId]);

  async function handleLogout() {
    await api.logout();
    router.push('/login');
  }

  if (error) return <main className="page"><p role="alert">{error}</p></main>;
  if (teams === null) return <main className="page"><p>Cargando...</p></main>;

  if (teams.length === 0) {
    return (
      <main className="page">
        <h1>WeeklyFeedback</h1>
        <div className="card">
          <p>Todavía no tenés ningún equipo.</p>
          <a className="btn btn-primary" href="/app/onboarding">Dar de alta tu primer equipo</a>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar">
        <h1 style={{ margin: 0 }}>WeeklyFeedback</h1>
        <button type="button" onClick={handleLogout}>
          Salir
        </button>
      </div>

      <label>
        Equipo
        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <h2>Histórico de informes</h2>
      {reports.length === 0 && <p>Todavía no hay informes generados para este equipo.</p>}
      <ul className="report-list">
        {reports.map((r) => (
          <li key={r.id}>
            <strong>Semana del {r.week_start}</strong>
            <pre>{r.content_markdown ?? '(pendiente de generar)'}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
