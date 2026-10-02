import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/reports/schedule',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getOrganization: (...args: unknown[]) => getOrganizationMock(...args),
    updateOrganization: (...args: unknown[]) => updateOrganizationMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import ReportSchedulePage from './page';

function org(overrides: Partial<ReturnType<typeof baseOrg>> = {}) {
  return { ...baseOrg(), ...overrides };
}
function baseOrg() {
  return {
    id: 'org-1',
    name: 'Acme',
    country: 'ES',
    contact_name: null,
    email: 'a@b.com',
    plan: 'equipo' as 'equipo' | 'organizacion' | 'custom',
    max_teams: 1,
    max_members_per_team: 10,
    reminder_dow: 1,
    reminder_time: '10:00',
    cutoff_time: '13:00',
    timezone: 'Europe/Madrid',
    language: 'es' as const,
    has_executive_summary: false,
    executive_summary_recipients: [] as string[],
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ReportSchedulePage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  updateOrganizationMock.mockReset();
  (trackEvent as any).mockClear();
});

describe('ReportSchedulePage — disponibilidad del resumen ejecutivo por plan', () => {
  it('Plan Equipo: sin resumen ejecutivo (con un equipo no hay nada que consolidar)', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'equipo' }));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Hora del recordatorio')).toBeInTheDocument());
    expect(screen.queryByText('Activar resumen ejecutivo')).not.toBeInTheDocument();
  });

  it('Plan Organización: ofrece el resumen ejecutivo', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'organizacion' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Activar resumen ejecutivo')).toBeInTheDocument());
  });
});

describe('ReportSchedulePage — guardar', () => {
  beforeEach(() => {
    getOrganizationMock.mockReset().mockResolvedValue(org({ plan: 'organizacion' }));
    updateOrganizationMock.mockReset();
  });

  it('guardar con éxito: trackea el evento y muestra "Cambios guardados"', async () => {
    updateOrganizationMock.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Hora del recordatorio')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByText('Cambios guardados.')).toBeInTheDocument());
    expect(trackEvent).toHaveBeenCalledWith('feedback_schedule_update');
    expect(updateOrganizationMock).toHaveBeenCalledWith({
      reminder_dow: 1,
      reminder_time: '10:00',
      cutoff_time: '13:00',
      timezone: 'Europe/Madrid',
      has_executive_summary: false,
      executive_summary_recipients: [],
    });
  });

  it('fallo al guardar: muestra el mensaje real del backend, no el de "guardado"', async () => {
    updateOrganizationMock.mockRejectedValue(new ApiError(400, 'Hora de corte antes que la del recordatorio'));
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Hora del recordatorio')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Hora de corte antes que la del recordatorio'));
    expect(screen.queryByText('Cambios guardados.')).not.toBeInTheDocument();
  });

  it('fallo al cargar la organización: muestra el error, no el formulario', async () => {
    getOrganizationMock.mockReset().mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los datos de planificación'));
  });

  it('el link "Informes" vuelve al dashboard de informes', async () => {
    getOrganizationMock.mockResolvedValue(org());
    renderPage();

    await waitFor(() => expect(screen.getByText('Informes').closest('a')).toHaveAttribute('href', '/app/reports'));
  });
});
