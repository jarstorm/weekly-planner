'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { api, ApiError, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

// Selector de equipos como cards, cada una lleva a su propia página
// (/app/team/[teamId]) — pedido explícito, antes era un <select> con todo
// (estado + histórico) apilado debajo en la misma página.
export default function TeamsPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const tNav = useTranslations('Nav');
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(() => api.listTeams())
      .then(setTeams)
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
        <p>{t('loading')}</p>
      </AppShell>
    );
  }

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

      <div className="team-card-grid">
        {teams.map((team) => (
          <Link key={team.id} href={`/app/team/${team.id}`} className="team-card">
            <span className="stat-icon"><Users size={18} /></span>
            <strong>{team.name}</strong>
            <span className="muted-link">{team.delivery_channel}</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
