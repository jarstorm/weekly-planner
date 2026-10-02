import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const addMemberMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });
const getEnabledChannelsMock = vi.fn().mockResolvedValue({ email: true, telegram: true, whatsapp: true });
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/team/team-1/members/new',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
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

import NewMemberPage from './page';

function renderPage() {
  (useParams as any).mockReturnValue({ teamId: 'team-1' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <NewMemberPage />
    </NextIntlClientProvider>,
  );
}

describe('NewMemberPage', () => {
  beforeEach(() => {
    addMemberMock.mockReset();
    pushMock.mockClear();
    (trackEvent as any).mockClear();
  });

  it('por defecto el canal es email, con la opción de WhatsApp disponible si el backend la habilitó', async () => {
    renderPage();

    await waitFor(() => expect(getEnabledChannelsMock).toHaveBeenCalled());
    const select = screen.getByLabelText('Canal') as HTMLSelectElement;
    expect(select.value).toBe('email');
    expect(screen.getByRole('option', { name: 'WhatsApp' })).toBeInTheDocument();
  });

  it('sin WhatsApp habilitado por el backend, no aparece como opción', async () => {
    getEnabledChannelsMock.mockResolvedValueOnce({ email: true, telegram: true, whatsapp: false });
    renderPage();

    await waitFor(() => expect(getEnabledChannelsMock).toHaveBeenCalled());
    expect(screen.queryByRole('option', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('alta con email: manda nombre/canal/contacto, trackea el evento y vuelve al listado del equipo', async () => {
    addMemberMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir miembro' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app/team/team-1/members'));
    expect(addMemberMock).toHaveBeenCalledWith('team-1', { name: 'Ana', channel: 'email', contact: 'ana@example.com' });
    expect(trackEvent).toHaveBeenCalledWith('member_add', { channel: 'email', context: 'team' });
  });

  it('cambiar a WhatsApp cambia el input de contacto al selector de país + número', async () => {
    renderPage();
    await waitFor(() => expect(getEnabledChannelsMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'whatsapp' } });

    expect(screen.getByLabelText('País')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('nombre@empresa.com')).not.toBeInTheDocument();
  });

  it('fallo al añadir: muestra el mensaje real del backend, no navega', async () => {
    addMemberMock.mockRejectedValue(new ApiError(400, 'Ese contacto ya está en uso'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir miembro' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ese contacto ya está en uso'));
    expect(pushMock).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
