'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, Circle, FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, CheckinStatus, Report, Team } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { ReportDetailSkeleton } from '@/components/Skeleton';

export default function ReportDetailPage() {
  const params = useParams<{ teamId: string; reportId: string }>();
  const teamId = params?.teamId ?? '';
  const reportId = params?.reportId ?? '';
  const t = useTranslations('ReportDetail');
  const tDash = useTranslations('Dashboard');

  const [team, setTeam] = useState<Team | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<CheckinStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !reportId) return;
    api.getTeam(teamId).then(setTeam).catch(() => setError(t('loadError')));
    api
      .listReports(teamId)
      .then((reports) => {
        const found = reports.find((r) => r.id === reportId);
        if (!found) {
          setError(t('notFound'));
          return;
        }
        setReport(found);
        return api.checkinStatus(teamId, found.week_start).then(setStatus);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t('loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, reportId]);

  if (error) {
    return (
      <AppShell>
        <p role="alert">{error}</p>
      </AppShell>
    );
  }
  if (!team || !report || !status) {
    return (
      <AppShell>
        <ReportDetailSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/app/team/${teamId}`} className="back-link">
        <ArrowLeft size={16} />
        {team.name}
      </Link>
      <div className="topbar">
        <h1 style={{ margin: 0 }}>{tDash('weekOf', { date: report.week_start })}</h1>
        <a className="btn btn-secondary" href={api.reportPdfUrl(report.id)}>
          <FileText size={15} />
          {tDash('downloadPdf')}
        </a>
      </div>

      <ul className="conversation-list">
        {status.map((m) => (
          <li key={m.memberId} className="conversation-item">
            <div className="conversation-item-header">
              <strong>{m.memberName}</strong>
              {m.responded ? (
                <span className="muted-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={15} />
                  {t('responded')}
                </span>
              ) : (
                <span className="muted-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Circle size={15} />
                  {t('notResponded')}
                </span>
              )}
            </div>

            {m.responded && m.audioUrl && (
              <>
                <audio className="conversation-audio" controls src={m.audioUrl} />
                <div className="conversation-field">
                  <div className="conversation-field-label">{t('transcript')}</div>
                  <p>{m.rawText}</p>
                </div>
              </>
            )}

            {m.responded && !m.audioUrl && (m.doneText || m.nextText || m.blockerText) && (
              <>
                {m.doneText && (
                  <div className="conversation-field">
                    <div className="conversation-field-label">{t('done')}</div>
                    <p>{m.doneText}</p>
                  </div>
                )}
                {m.nextText && (
                  <div className="conversation-field">
                    <div className="conversation-field-label">{t('next')}</div>
                    <p>{m.nextText}</p>
                  </div>
                )}
                {m.blockerText && (
                  <div className="conversation-field">
                    <div className="conversation-field-label">{t('blocker')}</div>
                    <p>{m.blockerText}</p>
                  </div>
                )}
              </>
            )}

            {m.responded && !m.audioUrl && !m.doneText && !m.nextText && !m.blockerText && (
              <div className="conversation-field">
                <p>{m.rawText}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
