import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';

const listTeamsMock = vi.fn();
const listReportsMock = vi.fn();
const listExecutiveSummariesMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/reports',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    listTeams: (...args: unknown[]) => listTeamsMock(...args),
    listReports: (...args: unknown[]) => listReportsMock(...args),
    listExecutiveSummaries: (...args: unknown[]) => listExecutiveSummariesMock(...args),
    reportPdfUrl: (reportId: string) => `https://api.test/reports/${reportId}/pdf`,
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import ReportsPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ReportsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listTeamsMock.mockReset();
  listReportsMock.mockReset();
  listExecutiveSummariesMock.mockReset().mockResolvedValue([]);
});

describe('ReportsPage', () => {
  it('ofrece la card "Planificar informe" que lleva a /app/reports/schedule', async () => {
    listTeamsMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Planificar informe')).toBeInTheDocument());
    expect(screen.getByText('Planificar informe').closest('a')).toHaveAttribute('href', '/app/reports/schedule');
  });

  it('sin equipos ni informes: muestra el mensaje de vacío', async () => {
    listTeamsMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no se ha generado ningún informe.')).toBeInTheDocument());
  });

  it('agrega los informes de todos los equipos y el resumen ejecutivo en una sola tabla, más reciente primero', async () => {
    listTeamsMock.mockResolvedValue([
      { id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] },
      { id: 'team-2', name: 'Ventas', company_context: '', report_recipients: [] },
    ]);
    listReportsMock.mockImplementation((teamId: string) =>
      Promise.resolve(
        teamId === 'team-1'
          ? [{ id: 'rep-1', week_start: '2026-01-05', content_markdown: 'x', generated_at: '2026-01-05', delivered_at: '2026-01-05' }]
          : [{ id: 'rep-2', week_start: '2026-01-12', content_markdown: 'x', generated_at: '2026-01-12', delivered_at: '2026-01-12' }],
      ),
    );
    listExecutiveSummariesMock.mockResolvedValue([
      { id: 'exec-1', week_start: '2026-01-12', content_markdown: 'x', generated_at: '2026-01-12', delivered_at: '2026-01-12' },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Producto')).toBeInTheDocument());
    const rows = screen.getAllByRole('row').slice(1); // sin la fila de cabecera
    expect(rows).toHaveLength(3);
    // El 2026-01-12 (team-2 y el resumen ejecutivo) va antes que el 2026-01-05 (team-1).
    expect(rows[0]).toHaveTextContent('2026-01-12');
    expect(rows[2]).toHaveTextContent('2026-01-05');
    expect(screen.getByText('Resumen ejecutivo')).toBeInTheDocument();
    const pdfLinks = screen.getAllByText('Descargar PDF');
    expect(pdfLinks[0].closest('a')).toHaveAttribute('href', expect.stringContaining('/pdf'));
  });

  it('fallo al cargar los equipos: muestra el error', async () => {
    listTeamsMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los informes'));
  });
});
