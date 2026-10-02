import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/settings',
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

import SettingsPage from './page';

function org(overrides: Partial<ReturnType<typeof baseOrg>> = {}) {
  return { ...baseOrg(), ...overrides };
}
function baseOrg() {
  return {
    id: 'org-1',
    name: 'Acme',
    country: 'ES' as string | null,
    contact_name: null as string | null,
    email: 'owner@example.com',
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
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SettingsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  updateOrganizationMock.mockReset();
  (trackEvent as any).mockClear();
});

describe('SettingsPage', () => {
  it('fallo al cargar: muestra el error, no el formulario', async () => {
    getOrganizationMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los datos de la empresa'));
    expect(screen.queryByLabelText('Nombre de la empresa')).not.toBeInTheDocument();
  });

  it('el email de registro se muestra pero no se puede editar', async () => {
    getOrganizationMock.mockResolvedValue(org());
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('owner@example.com')).toBeDisabled());
  });

  it('guardar manda solo name/country/contact_name/language, no el horario del feedback', async () => {
    getOrganizationMock.mockResolvedValue(org());
    updateOrganizationMock.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByText('Cambios guardados.')).toBeInTheDocument());
    expect(updateOrganizationMock).toHaveBeenCalledWith({ name: 'Acme', country: 'ES', contact_name: null, language: 'es' });
    expect(trackEvent).toHaveBeenCalledWith('settings_update');
  });

  it('quitar el país seleccionado manda null, no un string vacío', async () => {
    getOrganizationMock.mockResolvedValue(org());
    updateOrganizationMock.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('País'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateOrganizationMock).toHaveBeenCalled());
    expect(updateOrganizationMock).toHaveBeenCalledWith(expect.objectContaining({ country: null }));
  });

  it('cambiar el idioma de la cuenta viaja en el payload', async () => {
    getOrganizationMock.mockResolvedValue(org({ language: 'es' }));
    updateOrganizationMock.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Idioma de la cuenta'), { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateOrganizationMock).toHaveBeenCalled());
    expect(updateOrganizationMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
  });

  it('fallo al guardar: muestra el mensaje real del backend, no "guardado"', async () => {
    getOrganizationMock.mockResolvedValue(org());
    updateOrganizationMock.mockRejectedValue(new ApiError(400, 'Nombre de empresa requerido'));
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nombre de empresa requerido'));
    expect(screen.queryByText('Cambios guardados.')).not.toBeInTheDocument();
  });
});
