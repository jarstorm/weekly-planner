'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, Circle, Users } from 'lucide-react';
import { CheckinStatus } from '@/lib/api';

// Lunes de "esta semana" en el navegador del que mira el panel — solo para
// el widget de estado en vivo. La fuente de verdad para semanas pasadas es
// siempre report.week_start, calculado en el backend con el timezone del
// equipo (ver api/src/jobs/date.utils.ts).
export function mondayOfThisWeek(): string {
  const now = new Date();
  const dow = now.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export function ResponseStatusList({ status }: { status: CheckinStatus[] }) {
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

export function ResponsePercent({ status }: { status: CheckinStatus[] }) {
  const t = useTranslations('Dashboard');
  if (status.length === 0) return null;
  const responded = status.filter((s) => s.responded).length;
  const pct = Math.round((responded / status.length) * 100);
  return (
    <p className="response-percent">
      {t('responsePercent', { pct, responded, total: status.length })}
    </p>
  );
}

export function ResponseRate({ status }: { status: CheckinStatus[] }) {
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
