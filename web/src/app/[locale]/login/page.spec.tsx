import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const loginMock = vi.fn();
const pushMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    login: (...args: unknown[]) => loginMock(...args),
    // BrandMark usa useHomeHref, que llama a api.me() al montar.
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

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import LoginPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <LoginPage />
    </NextIntlClientProvider>,
  );
}

function fillAndSubmit(email = 'a@b.com', password = 'password123') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
    pushMock.mockClear();
    (trackEvent as any).mockClear();
  });

  it('login correcto: trackea el evento y redirige a /app', async () => {
    loginMock.mockResolvedValue(undefined);
    renderPage();

    fillAndSubmit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app'));
    expect(loginMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(trackEvent).toHaveBeenCalledWith('login');
  });

  it('credenciales incorrectas: muestra el mensaje real del backend (ApiError), no redirige', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'Email o contraseña incorrectos'));
    renderPage();

    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
    expect(pushMock).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('error que no es ApiError (red caída, etc.): cae en el mensaje genérico traducido', async () => {
    loginMock.mockRejectedValue(new Error('network down'));
    renderPage();

    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo entrar');
  });

  it('deshabilita el botón y cambia el texto mientras está cargando', async () => {
    let resolveLogin: () => void = () => {};
    loginMock.mockReturnValue(new Promise<void>((resolve) => (resolveLogin = resolve)));
    renderPage();

    fillAndSubmit();

    const button = await screen.findByRole('button', { name: 'Entrando...' });
    expect(button).toBeDisabled();

    resolveLogin();
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
  });

  it('un segundo intento tras un error limpia el mensaje anterior', async () => {
    loginMock.mockRejectedValueOnce(new ApiError(401, 'Email o contraseña incorrectos'));
    renderPage();
    fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    loginMock.mockResolvedValueOnce(undefined);
    fillAndSubmit();

    // Mientras se reenvía, el error anterior ya no debería quedar visible al terminar.
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
