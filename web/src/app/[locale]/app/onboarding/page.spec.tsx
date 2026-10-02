import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const createTeamMock = vi.fn();
const addMemberMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });
const getEnabledChannelsMock = vi.fn().mockResolvedValue({ email: true, telegram: true, whatsapp: false });
const pushMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/onboarding',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    createTeam: (...args: unknown[]) => createTeamMock(...args),
    addMember: (...args: unknown[]) => addMemberMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    getEnabledChannels: (...args: unknown[]) => getEnabledChannelsMock(...args),
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

import OnboardingPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <OnboardingPage />
    </NextIntlClientProvider>,
  );
}

async function createTeam(name = 'Producto') {
  fireEvent.change(screen.getByLabelText('Nombre del equipo'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));
  await waitFor(() => expect(screen.getByText(`Miembros de ${name}`)).toBeInTheDocument());
}

describe('OnboardingPage — paso 1: alta de equipo', () => {
  beforeEach(() => {
    createTeamMock.mockReset();
    addMemberMock.mockReset();
    pushMock.mockClear();
    (trackEvent as any).mockClear();
  });

  it('crear el equipo trackea el evento y pasa al paso 2 (alta de miembros)', async () => {
    createTeamMock.mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    renderPage();

    await createTeam();

    expect(createTeamMock).toHaveBeenCalledWith({ name: 'Producto', company_context: '' });
    expect(trackEvent).toHaveBeenCalledWith('team_create');
  });

  it('fallo al crear: muestra el mensaje real del backend y se queda en el paso 1', async () => {
    createTeamMock.mockRejectedValue(new ApiError(400, 'Ya tienes un equipo con ese nombre'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Nombre del equipo'), { target: { value: 'Producto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ya tienes un equipo con ese nombre'));
    expect(screen.getByLabelText('Nombre del equipo')).toBeInTheDocument();
  });
});

describe('OnboardingPage — paso 2: alta de miembros del equipo recién creado', () => {
  beforeEach(() => {
    createTeamMock.mockReset().mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    addMemberMock.mockReset();
    pushMock.mockClear();
    (trackEvent as any).mockClear();
  });

  it('añadir un miembro lo suma a la lista y limpia nombre/contacto, pero no el canal', async () => {
    addMemberMock.mockResolvedValue(undefined);
    renderPage();
    await createTeam();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir miembro' }));

    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());
    expect(addMemberMock).toHaveBeenCalledWith('team-1', { name: 'Ana', channel: 'email', contact: 'ana@example.com' });
    expect(trackEvent).toHaveBeenCalledWith('member_add', { channel: 'email', context: 'onboarding' });
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('');
  });

  it('se pueden añadir varios miembros, todos quedan listados', async () => {
    addMemberMock.mockResolvedValue(undefined);
    renderPage();
    await createTeam();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir miembro' }));
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Bruno' } });
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'bruno@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir miembro' }));

    await waitFor(() => expect(screen.getByText('Bruno')).toBeInTheDocument());
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(addMemberMock).toHaveBeenCalledTimes(2);
  });

  it('fallo al añadir un miembro: muestra el error, no lo suma a la lista', async () => {
    addMemberMock.mockRejectedValue(new ApiError(400, 'Contacto inválido'));
    renderPage();
    await createTeam();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir miembro' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Contacto inválido'));
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('"Terminar" lleva al dashboard, con o sin miembros añadidos', async () => {
    renderPage();
    await createTeam();

    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(pushMock).toHaveBeenCalledWith('/app');
  });

  it('sin WhatsApp habilitado por el backend, el selector de canal no lo ofrece', async () => {
    renderPage();
    await createTeam();

    expect(screen.queryByRole('option', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });
});
