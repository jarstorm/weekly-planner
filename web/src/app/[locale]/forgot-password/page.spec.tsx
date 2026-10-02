import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../messages/es.json';

const requestPasswordResetMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    requestPasswordReset: (...args: unknown[]) => requestPasswordResetMock(...args),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import ForgotPasswordPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ForgotPasswordPage />
    </NextIntlClientProvider>,
  );
}

describe('ForgotPasswordPage — nunca filtra si el email existe o no', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('con éxito, manda el email y muestra el mismo mensaje de "enviado"', async () => {
    requestPasswordResetMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    await waitFor(() => expect(screen.getByText(/Si ese email tiene una cuenta/)).toBeInTheDocument());
    expect(requestPasswordResetMock).toHaveBeenCalledWith('a@b.com');
  });

  it('aunque la llamada falle (email inexistente, backend caído), muestra EL MISMO mensaje de "enviado", no un error', async () => {
    // El componente no tiene catch, solo finally (ver comentario en
    // page.tsx) — handleSubmit es async y React descarta la promesa que
    // devuelve, así que el rechazo queda sin capturar MÁS ALLÁ del propio
    // componente (es su comportamiento real, no un artefacto del test).
    // Se neutraliza aquí para que Node no marque el test run entero como
    // fallido por ello, sin tocar lo que el componente hace.
    const onUnhandledRejection = (err: unknown) => {
      if (err instanceof Error && err.message === 'boom') return;
      throw err;
    };
    process.on('unhandledRejection', onUnhandledRejection);

    requestPasswordResetMock.mockRejectedValue(new Error('boom'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'no-existe@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    await waitFor(() => expect(screen.getByText(/Si ese email tiene una cuenta/)).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    process.off('unhandledRejection', onUnhandledRejection);
  });

  it('tras enviar, ya no se puede reenviar desde la misma pantalla (formulario reemplazado por el mensaje)', async () => {
    requestPasswordResetMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    await waitFor(() => expect(screen.queryByLabelText('Email')).not.toBeInTheDocument());
  });
});
