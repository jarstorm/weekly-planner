import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
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
    plan: 'equipo' as const,
    max_teams: 1,
    max_members_per_team: 10,
    reminder_dow: 1,
    reminder_time: '10:00',
    cutoff_time: '13:00',
    timezone: 'Europe/Madrid',
    language: 'es' as const,
    has_executive_summary: false,
    executive_summary_recipients: [] as string[],
    has_monthly_survey: false,
    survey_questions: [] as string[],
    survey_day_of_month: 1,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <FeedbackConfigPage />
    </NextIntlClientProvider>,
  );
}

describe('FeedbackConfigPage — disponibilidad por plan', () => {
  beforeEach(() => {
    getOrganizationMock.mockReset();
    updateOrganizationMock.mockReset();
    (trackEvent as any).mockClear();
  });

  it('Plan Equipo: sin resumen ejecutivo ni encuesta mensual (con un equipo no hay nada que consolidar)', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'equipo' }));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Hora del recordatorio')).toBeInTheDocument());
    expect(screen.queryByText('Activar resumen ejecutivo')).not.toBeInTheDocument();
    expect(screen.queryByText('Activar encuesta mensual anónima')).not.toBeInTheDocument();
  });

  it('Plan Organización: ofrece resumen ejecutivo y encuesta mensual', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'organizacion' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Activar resumen ejecutivo')).toBeInTheDocument());
    expect(screen.getByText('Activar encuesta mensual anónima')).toBeInTheDocument();
  });

  it('Plan Custom: igual que Organización', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'custom' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Activar resumen ejecutivo')).toBeInTheDocument());
  });
});

describe('FeedbackConfigPage — guardar', () => {
  beforeEach(() => {
    getOrganizationMock.mockReset().mockResolvedValue(org({ plan: 'organizacion' }));
    updateOrganizationMock.mockReset();
    (trackEvent as any).mockClear();
  });

  it('guardar con éxito: trackea el evento y muestra "Cambios guardados"', async () => {
    updateOrganizationMock.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Hora del recordatorio')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByText('Cambios guardados.')).toBeInTheDocument());
    expect(trackEvent).toHaveBeenCalledWith('feedback_schedule_update');
    expect(updateOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_dow: 1, reminder_time: '10:00', cutoff_time: '13:00', timezone: 'Europe/Madrid' }),
    );
  });

  it('activar la encuesta mensual y añadir una pregunta viaja en el payload', async () => {
    updateOrganizationMock.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Activar encuesta mensual anónima')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Activar encuesta mensual anónima'));
    const questionInput = screen.getByPlaceholderText('Escribe una pregunta');
    fireEvent.change(questionInput, { target: { value: '¿Qué tal el mes?' } });
    const questionsEditor = questionInput.closest('div')!.parentElement!;
    fireEvent.click(within(questionsEditor).getByRole('button', { name: 'Añadir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateOrganizationMock).toHaveBeenCalled());
    expect(updateOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({ has_monthly_survey: true, survey_questions: ['¿Qué tal el mes?'] }),
    );
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
