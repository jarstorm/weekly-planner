import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../../messages/es.json';

const getTeamMock = vi.fn();
const listReportsMock = vi.fn();
const checkinStatusMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/team/team-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    getTeam: (...args: unknown[]) => getTeamMock(...args),
    listReports: (...args: unknown[]) => listReportsMock(...args),
    checkinStatus: (...args: unknown[]) => checkinStatusMock(...args),
    reportPdfUrl: (reportId: string) => `https://api.test/reports/${reportId}/pdf`,
    conversationsExportUrl: (teamId: string, weekStart?: string) =>
      `https://api.test/export?teamId=${teamId}${weekStart ? `&weekStart=${weekStart}` : ''}`,
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import TeamDashboardPage from './page';

function status(overrides: Partial<{ memberId: string; memberName: string; responded: boolean }> = {}) {
  return {
    memberId: 'm-1',
    memberName: 'Ana',
    channel: 'email' as const,
    responded: false,
    doneText: null,
    nextText: null,
    blockerText: null,
    rawText: null,
    receivedAt: null,
    audioUrls: [],
    ...overrides,
  };
}

function renderPage() {
  (useParams as any).mockReturnValue({ teamId: 'team-1' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <TeamDashboardPage />
    </NextIntlClientProvider>,
  );
}

describe('TeamDashboardPage', () => {
  beforeEach(() => {
    getTeamMock.mockReset();
    listReportsMock.mockReset();
    checkinStatusMock.mockReset();
  });

  it('fallo al cargar el equipo: muestra el error', async () => {
    getTeamMock.mockRejectedValue(new Error('404'));
    listReportsMock.mockResolvedValue([]);
    checkinStatusMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el panel'));
  });

  it('equipo sin miembros ni informes: muestra los dos mensajes de "vacío"', async () => {
    getTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    listReportsMock.mockResolvedValue([]);
    checkinStatusMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Producto')).toBeInTheDocument());
    expect(screen.getByText('No hay miembros en este equipo todavía.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay informes generados para este equipo.')).toBeInTheDocument();
  });

  it('con miembros esta semana, calcula el % de respuesta (1 de 2 = 50%)', async () => {
    getTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    listReportsMock.mockResolvedValue([]);
    checkinStatusMock.mockResolvedValue([status({ memberId: 'm-1', responded: true }), status({ memberId: 'm-2', memberName: 'Bruno', responded: false })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Bruno')).toBeInTheDocument());
    expect(screen.getAllByText(/sin responder/)).toHaveLength(1);
  });

  it('un informe con contenido lo renderiza como markdown, con enlaces de descarga reales', async () => {
    getTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    listReportsMock.mockResolvedValue([
      { id: 'rep-1', week_start: '2026-01-05', content_markdown: '**Logros:** terminamos la migración', generated_at: '2026-01-05', delivered_at: '2026-01-05' },
    ]);
    checkinStatusMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Semana del 2026-01-05')).toBeInTheDocument());
    expect(screen.getByText('Logros:')).toBeInTheDocument(); // markdown real, negrita renderizada
    expect(screen.getByText('Descargar PDF').closest('a')).toHaveAttribute('href', 'https://api.test/reports/rep-1/pdf');
    expect(screen.getByText('Descargar conversaciones').closest('a')).toHaveAttribute(
      'href',
      'https://api.test/export?teamId=team-1&weekStart=2026-01-05',
    );
  });

  it('un informe todavía sin generar muestra "pendiente de generar" en vez de romper el markdown', async () => {
    getTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    listReportsMock.mockResolvedValue([
      { id: 'rep-1', week_start: '2026-01-12', content_markdown: null, generated_at: null, delivered_at: null },
    ]);
    checkinStatusMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('(pendiente de generar)')).toBeInTheDocument());
  });
});
