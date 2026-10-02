import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';

const resetPasswordMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
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

import ResetPasswordPage from './page';

function renderPage() {
  (useParams as any).mockReturnValue({ token: 'tok-123' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ResetPasswordPage />
    </NextIntlClientProvider>,
  );
}

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('ResetPasswordPage', () => {
  it('contraseñas que no coinciden: error en cliente, nunca llama al backend', async () => {
    renderPage();

    fill('password123', 'otra-password');

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('contraseñas que coinciden: manda token+password al backend y muestra éxito', async () => {
    resetPasswordMock.mockResolvedValue(undefined);
    renderPage();

    fill('password123', 'password123');

    await waitFor(() => expect(screen.getByText('Contraseña cambiada. Ya puedes entrar.')).toBeInTheDocument());
    expect(resetPasswordMock).toHaveBeenCalledWith('tok-123', 'password123');
  });

  it('token inválido/caducado: muestra el mensaje real del backend', async () => {
    resetPasswordMock.mockRejectedValue(new ApiError(404, 'Enlace inválido'));
    renderPage();

    fill('password123', 'password123');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Enlace inválido'));
  });

  it('error que no es ApiError: cae en el mensaje genérico de enlace inválido', async () => {
    resetPasswordMock.mockRejectedValue(new Error('network down'));
    renderPage();

    fill('password123', 'password123');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido o ha caducado.'));
  });

  it('corregir el segundo campo tras un mismatch y reenviar, ya no muestra el error de coincidencia', async () => {
    resetPasswordMock.mockResolvedValue(undefined);
    renderPage();

    fill('password123', 'otra-password');
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => expect(screen.getByText('Contraseña cambiada. Ya puedes entrar.')).toBeInTheDocument());
  });
});
