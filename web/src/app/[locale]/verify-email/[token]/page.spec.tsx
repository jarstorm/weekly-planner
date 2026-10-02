import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';

const verifyEmailMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    verifyEmail: (...args: unknown[]) => verifyEmailMock(...args),
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
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import VerifyEmailPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <VerifyEmailPage />
    </NextIntlClientProvider>,
  );
}

describe('VerifyEmailPage', () => {
  it('empieza en loading con el token de la URL', () => {
    (useParams as any).mockReturnValue({ token: 'tok-123' });
    verifyEmailMock.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Confirmando tu email...')).toBeInTheDocument();
  });

  it('token válido: confirma y ofrece ir a entrar', async () => {
    (useParams as any).mockReturnValue({ token: 'tok-123' });
    verifyEmailMock.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => expect(screen.getByText('Email confirmado. Ya puedes entrar.')).toBeInTheDocument());
    expect(verifyEmailMock).toHaveBeenCalledWith('tok-123');
    expect(screen.getByText('Ir a entrar')).toBeInTheDocument();
  });

  it('token inválido/caducado: muestra el mensaje real del backend', async () => {
    (useParams as any).mockReturnValue({ token: 'tok-malo' });
    verifyEmailMock.mockRejectedValue(new ApiError(404, 'Enlace inválido'));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Enlace inválido'));
  });

  it('error que no es ApiError: cae en el mensaje genérico de enlace inválido', async () => {
    (useParams as any).mockReturnValue({ token: 'tok-malo' });
    verifyEmailMock.mockRejectedValue(new Error('network down'));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido o ha caducado.'));
  });

  it('sin token en la URL, llama a verifyEmail con string vacío en vez de romper', () => {
    (useParams as any).mockReturnValue({});
    verifyEmailMock.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(verifyEmailMock).toHaveBeenCalledWith('');
  });
});
