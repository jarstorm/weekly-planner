import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const getTeamMock = vi.fn();
const updateTeamMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/team/team-1/edit',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getTeam: (...args: unknown[]) => getTeamMock(...args),
    updateTeam: (...args: unknown[]) => updateTeamMock(...args),
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

import EditTeamPage from './page';

function team(overrides: Partial<{ id: string; name: string; company_context: string; report_recipients: string[] }> = {}) {
  return { id: 'team-1', name: 'Producto', company_context: '', report_recipients: [], ...overrides };
}

function renderPage() {
  (useParams as any).mockReturnValue({ teamId: 'team-1' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <EditTeamPage />
    </NextIntlClientProvider>,
  );
}

describe('EditTeamPage', () => {
  beforeEach(() => {
    getTeamMock.mockReset();
    updateTeamMock.mockReset();
    pushMock.mockClear();
    (trackEvent as any).mockClear();
  });

  it('fallo al cargar el equipo: muestra el error, no el formulario', async () => {
    getTeamMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el equipo'));
    expect(screen.queryByLabelText('Nombre del equipo')).not.toBeInTheDocument();
  });

  it('sin destinatarios, muestra el hint de que el informe no se manda a nadie', async () => {
    getTeamMock.mockResolvedValue(team());
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('Producto')).toBeInTheDocument());
    expect(screen.getByText('Todavía no hay destinatarios — el informe se genera pero no se envía a nadie.')).toBeInTheDocument();
  });

  it('añadir un destinatario y guardar: manda el team completo actualizado, trackea y navega', async () => {
    getTeamMock.mockResolvedValue(team());
    updateTeamMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Producto')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'jefe@example.com' } });
    fireEvent.click(screen.getByText('Añadir'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app/team/team-1'));
    expect(updateTeamMock).toHaveBeenCalledWith('team-1', team({ report_recipients: ['jefe@example.com'] }));
    expect(trackEvent).toHaveBeenCalledWith('team_update');
  });

  it('fallo al guardar: muestra el mensaje real del backend, no navega', async () => {
    getTeamMock.mockResolvedValue(team());
    updateTeamMock.mockRejectedValue(new ApiError(400, 'Nombre de equipo repetido'));
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Producto')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nombre de equipo repetido'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('editar el nombre y el contexto de empresa actualiza el payload enviado', async () => {
    getTeamMock.mockResolvedValue(team());
    updateTeamMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Producto')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre del equipo'), { target: { value: 'Producto y Diseño' } });
    fireEvent.change(screen.getByLabelText('Contexto de la empresa (opcional)'), { target: { value: 'SaaS B2B de 15 personas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateTeamMock).toHaveBeenCalled());
    expect(updateTeamMock).toHaveBeenCalledWith('team-1', team({ name: 'Producto y Diseño', company_context: 'SaaS B2B de 15 personas' }));
  });
});
