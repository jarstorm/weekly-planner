import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../../../../messages/es.json';

const getTeamMock = vi.fn();
const listReportsMock = vi.fn();
const checkinStatusMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/team/team-1/report/rep-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    getTeam: (...args: unknown[]) => getTeamMock(...args),
    listReports: (...args: unknown[]) => listReportsMock(...args),
    checkinStatus: (...args: unknown[]) => checkinStatusMock(...args),
    reportPdfUrl: (reportId: string) => `https://api.test/reports/${reportId}/pdf`,
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import ReportDetailPage from './page';

function status(overrides: Partial<ReturnType<typeof baseStatus>> = {}) {
  return { ...baseStatus(), ...overrides };
}
function baseStatus() {
  return {
    memberId: 'm-1',
    memberName: 'Ana',
    channel: 'email' as const,
    responded: true,
    doneText: null as string | null,
    nextText: null as string | null,
    blockerText: null as string | null,
    rawText: null as string | null,
    receivedAt: '2026-01-05T10:00:00Z',
    audioUrls: [] as string[],
  };
}

function renderPage() {
  (useParams as any).mockReturnValue({ teamId: 'team-1', reportId: 'rep-1' });
  getTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
  listReportsMock.mockResolvedValue([
    { id: 'rep-1', week_start: '2026-01-05', content_markdown: '# Informe', generated_at: '2026-01-05', delivered_at: '2026-01-05' },
  ]);
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ReportDetailPage />
    </NextIntlClientProvider>,
  );
}

describe('ReportDetailPage', () => {
  beforeEach(() => {
    getTeamMock.mockReset();
    listReportsMock.mockReset();
    checkinStatusMock.mockReset();
  });

  it('reportId que no pertenece a este equipo: muestra "no existe", no la lista de conversaciones', async () => {
    (useParams as any).mockReturnValue({ teamId: 'team-1', reportId: 'rep-ajeno' });
    getTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    listReportsMock.mockResolvedValue([
      { id: 'rep-1', week_start: '2026-01-05', content_markdown: '# Informe', generated_at: '2026-01-05', delivered_at: '2026-01-05' },
    ]);
    render(
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <ReportDetailPage />
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este informe no existe o no pertenece a este equipo'));
  });

  it('miembro que no respondió: muestra "Sin responder", sin ningún contenido', async () => {
    checkinStatusMock.mockResolvedValue([status({ responded: false })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Sin responder')).toBeInTheDocument());
    expect(screen.queryByText('Qué hizo')).not.toBeInTheDocument();
  });

  it('respuesta con nota de voz: muestra el audio y la transcripción, no los campos estructurados', async () => {
    checkinStatusMock.mockResolvedValue([
      status({ audioUrls: ['https://storage.test/audio1.ogg'], rawText: 'transcripción completa', doneText: 'esto no debería verse' }),
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Transcripción del audio')).toBeInTheDocument());
    expect(screen.getByText('transcripción completa')).toBeInTheDocument();
    expect(document.querySelector('audio[src="https://storage.test/audio1.ogg"]')).toBeInTheDocument();
    expect(screen.queryByText('Qué hizo')).not.toBeInTheDocument();
  });

  it('respuesta con texto estructurado (sin audio): muestra solo los campos que vinieron rellenos', async () => {
    checkinStatusMock.mockResolvedValue([status({ doneText: 'Terminé la migración', nextText: null, blockerText: 'Esperando acceso' })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Qué hizo')).toBeInTheDocument());
    expect(screen.getByText('Terminé la migración')).toBeInTheDocument();
    expect(screen.queryByText('Qué hará')).not.toBeInTheDocument();
    expect(screen.getByText('Bloqueo')).toBeInTheDocument();
    expect(screen.getByText('Esperando acceso')).toBeInTheDocument();
  });

  it('respuesta sin audio ni campos estructurados: cae en el texto crudo', async () => {
    checkinStatusMock.mockResolvedValue([status({ rawText: 'todo bien esta semana' })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('todo bien esta semana')).toBeInTheDocument());
    expect(screen.queryByText('Qué hizo')).not.toBeInTheDocument();
  });

  it('el link de descargar PDF apunta al informe correcto', async () => {
    checkinStatusMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Semana del 2026-01-05')).toBeInTheDocument());
    expect(screen.getByText('Descargar PDF').closest('a')).toHaveAttribute('href', 'https://api.test/reports/rep-1/pdf');
  });
});
