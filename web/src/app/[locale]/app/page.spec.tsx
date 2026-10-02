import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../messages/es.json';
import { ApiError } from '@/lib/api';

const meMock = vi.fn();
const listTeamsMock = vi.fn();
const listMembersMock = vi.fn();
const listReportsMock = vi.fn();
const checkinStatusMock = vi.fn();
const getOrganizationMock = vi.fn();
const listExecutiveSummariesMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });
const pushMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/api', () => ({
  api: {
    me: (...args: unknown[]) => meMock(...args),
    listTeams: (...args: unknown[]) => listTeamsMock(...args),
    listMembers: (...args: unknown[]) => listMembersMock(...args),
    listReports: (...args: unknown[]) => listReportsMock(...args),
    checkinStatus: (...args: unknown[]) => checkinStatusMock(...args),
    getOrganization: (...args: unknown[]) => getOrganizationMock(...args),
    listExecutiveSummaries: (...args: unknown[]) => listExecutiveSummariesMock(...args),
    reportPdfUrl: (reportId: string) => `https://api.test/reports/${reportId}/pdf`,
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import TeamsPage from './page';

function team(overrides: Partial<{ id: string; name: string; report_recipients: string[] }> = {}) {
  return { id: 'team-1', name: 'Producto', company_context: '', report_recipients: ['jefe@example.com'], ...overrides };
}
function org(overrides: Partial<{ has_executive_summary: boolean; max_teams: number | null }> = {}) {
  return {
    id: 'org-1',
    name: 'Acme',
    country: 'ES',
    contact_name: null,
    email: 'a@b.com',
    plan: 'organizacion' as const,
    max_teams: 5 as number | null,
    max_members_per_team: 20,
    reminder_dow: 1,
    reminder_time: '10:00:00',
    cutoff_time: '13:00:00',
    timezone: 'Europe/Madrid',
    language: 'es' as const,
    has_executive_summary: false,
    executive_summary_recipients: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <TeamsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  meMock.mockReset().mockResolvedValue({ userId: 'u-1', email: 'a@b.com', organizationId: 'org-1' });
  listTeamsMock.mockReset();
  listMembersMock.mockReset();
  listReportsMock.mockReset();
  checkinStatusMock.mockReset();
  getOrganizationMock.mockReset();
  listExecutiveSummariesMock.mockReset();
  pushMock.mockClear();
});

describe('TeamsPage — carga', () => {
  it('sesión caducada (401): redirige a /login', async () => {
    meMock.mockRejectedValue(new ApiError(401, 'Sesión inválida'));
    renderPage();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
  });

  it('otro fallo al cargar los equipos: muestra el error genérico', async () => {
    meMock.mockResolvedValue({});
    listTeamsMock.mockRejectedValue(new Error('network down'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el panel'));
  });
});

describe('TeamsPage — sin equipos todavía', () => {
  it('muestra el mensaje de "sin equipos" y el link para dar de alta el primero', async () => {
    listTeamsMock.mockResolvedValue([]);
    getOrganizationMock.mockResolvedValue(org());
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no tienes ningún equipo.')).toBeInTheDocument());
    expect(screen.getByText('Dar de alta tu primer equipo').closest('a')).toHaveAttribute('href', '/app/onboarding');
  });
});

describe('TeamsPage — con equipos', () => {
  beforeEach(() => {
    listTeamsMock.mockReset().mockResolvedValue([team()]);
    listMembersMock.mockReset().mockResolvedValue([
      { id: 'm-1', team_id: 'team-1', name: 'Ana', channel: 'email', contact: 'ana@example.com', active: true, email_verified_at: null },
    ]);
    listReportsMock.mockReset().mockResolvedValue([]);
    checkinStatusMock
      .mockReset()
      .mockResolvedValue([{ memberId: 'm-1', memberName: 'Ana', channel: 'email', responded: true, doneText: null, nextText: null, blockerText: null, rawText: null, receivedAt: null, audioUrls: [] }]);
    getOrganizationMock.mockReset().mockResolvedValue(org());
  });

  it('calcula las estadísticas agregadas (equipos, miembros, informes, % de respuesta)', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Miembros totales')).toBeInTheDocument());
    // 1 equipo, 1 miembro, 0 informes, 100% de respuesta esta semana (1/1).
    expect(screen.getByText('Miembros totales').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Respuesta esta semana').previousElementSibling).toHaveTextContent('100%');
  });

  it('ningún equipo con destinatarios configurados: muestra el aviso', async () => {
    listTeamsMock.mockResolvedValue([team({ report_recipients: [] })]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Ningún equipo tiene destinatarios configurados todavía/)).toBeInTheDocument());
  });

  it('con al menos un equipo con destinatarios, no muestra el aviso', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Producto')).toBeInTheDocument());
    expect(screen.queryByText(/Ningún equipo tiene destinatarios configurados todavía/)).not.toBeInTheDocument();
  });

  it('en el límite de equipos del plan, no ofrece la card de "nuevo equipo"', async () => {
    getOrganizationMock.mockResolvedValue(org({ max_teams: 1 })); // 1 equipo ya = al límite
    renderPage();

    await waitFor(() => expect(screen.getByText('Producto')).toBeInTheDocument());
    expect(screen.queryByText('Nuevo equipo')).not.toBeInTheDocument();
  });

  it('por debajo del límite de equipos, sí ofrece la card de "nuevo equipo"', async () => {
    getOrganizationMock.mockResolvedValue(org({ max_teams: 5 }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Nuevo equipo')).toBeInTheDocument());
  });

  it('un equipo con informe reciente muestra el link de descarga; sin informes, "Sin informes todavía"', async () => {
    listReportsMock.mockResolvedValue([{ id: 'rep-1', week_start: '2026-01-05', content_markdown: '# x', generated_at: '2026-01-05', delivered_at: '2026-01-05' }]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Informe del 2026-01-05/)).toBeInTheDocument());
    expect(screen.getByText(/Informe del 2026-01-05/).closest('a')).toHaveAttribute('href', 'https://api.test/reports/rep-1/pdf');
  });

  it('sin resumen ejecutivo activado, no muestra esa sección', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Producto')).toBeInTheDocument());
    expect(screen.queryByText('Resumen ejecutivo')).not.toBeInTheDocument();
  });

  it('con resumen ejecutivo activado pero sin informes generados todavía, muestra el hint de espera', async () => {
    getOrganizationMock.mockResolvedValue(org({ has_executive_summary: true }));
    listExecutiveSummariesMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Resumen ejecutivo')).toBeInTheDocument());
    expect(screen.getByText(/Todavía no se ha generado ningún resumen ejecutivo/)).toBeInTheDocument();
  });

  it('con resumen ejecutivo y al menos uno generado, lo lista con su link de descarga', async () => {
    getOrganizationMock.mockResolvedValue(org({ has_executive_summary: true }));
    listExecutiveSummariesMock.mockResolvedValue([
      { id: 'exec-1', week_start: '2026-01-05', content_markdown: '# resumen', generated_at: '2026-01-05', delivered_at: '2026-01-05' },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Semana del 2026-01-05')).toBeInTheDocument());
  });
});
