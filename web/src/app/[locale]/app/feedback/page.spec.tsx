import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const getPendingSurveyMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/feedback',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getOrganization: (...args: unknown[]) => getOrganizationMock(...args),
    updateOrganization: (...args: unknown[]) => updateOrganizationMock(...args),
    getPendingSurvey: (...args: unknown[]) => getPendingSurveyMock(...args),
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

import FeedbackConfigPage from './page';

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
      <FeedbackConfigPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  updateOrganizationMock.mockReset();
  getPendingSurveyMock.mockReset().mockResolvedValue(null);
  (trackEvent as any).mockClear();
});

describe('FeedbackConfigPage — disponibilidad por plan', () => {
  it('Plan Equipo: sin resumen ejecutivo ni encuesta anónima (con un equipo no hay nada que consolidar)', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'equipo' }));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Hora del recordatorio')).toBeInTheDocument());
    expect(screen.queryByText('Activar resumen ejecutivo')).not.toBeInTheDocument();
    expect(screen.queryByText('Encuesta anónima')).not.toBeInTheDocument();
  });

  it('Plan Organización: ofrece resumen ejecutivo y la sección de encuesta anónima', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'organizacion' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Activar resumen ejecutivo')).toBeInTheDocument());
    expect(screen.getByText('Encuesta anónima')).toBeInTheDocument();
  });

  it('Plan Custom: igual que Organización', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'custom' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Activar resumen ejecutivo')).toBeInTheDocument());
    expect(screen.getByText('Encuesta anónima')).toBeInTheDocument();
  });
});

describe('FeedbackConfigPage — encuesta anónima (de un solo envío, no recurrente)', () => {
  beforeEach(() => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'organizacion' }));
  });

  it('sin ninguna pendiente: ofrece el botón de crear una nueva, que lleva a /app/survey/new', async () => {
    getPendingSurveyMock.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText('Crear nueva encuesta')).toBeInTheDocument());
    expect(screen.getByText('Crear nueva encuesta').closest('a')).toHaveAttribute('href', '/app/survey/new');
  });

  it('con una pendiente: muestra su fecha/hora/timezone, sin ofrecer el botón de crear otra', async () => {
    getPendingSurveyMock.mockResolvedValue({
      id: 'survey-1',
      questions: ['¿Qué tal?', '¿Algo que mejorar?'],
      scheduledDate: '2026-02-01',
      scheduledTime: '10:00',
      timezone: 'Europe/Madrid',
    });
    renderPage();

    await waitFor(() => expect(screen.getByText(/2026-02-01/)).toBeInTheDocument());
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.queryByText('Crear nueva encuesta')).not.toBeInTheDocument();
  });

  it('el link a resultados está siempre disponible, con o sin pendiente', async () => {
    getPendingSurveyMock.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText('Ver resultados de encuestas anteriores')).toBeInTheDocument());
    expect(screen.getByText('Ver resultados de encuestas anteriores').closest('a')).toHaveAttribute('href', '/app/survey');
  });

  it('si falla la comprobación de pendiente, no rompe el resto de la página (cae en "sin pendiente")', async () => {
    getPendingSurveyMock.mockRejectedValue(new Error('network down'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Crear nueva encuesta')).toBeInTheDocument());
  });
});

describe('FeedbackConfigPage — guardar el horario', () => {
  beforeEach(() => {
    getOrganizationMock.mockReset().mockResolvedValue(org({ plan: 'organizacion' }));
    updateOrganizationMock.mockReset();
  });

  it('guardar con éxito: trackea el evento y muestra "Cambios guardados", sin tocar nada de encuestas', async () => {
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

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los datos de la empresa'));
  });
});
