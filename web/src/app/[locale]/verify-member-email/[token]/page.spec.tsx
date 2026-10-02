import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';

const verifyMemberEmailMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
// BrandMark usa Link de @/i18n/navigation — ver mismo comentario en
// register/page.spec.tsx y AppShell.spec.tsx.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    verifyMemberEmail: (...args: unknown[]) => verifyMemberEmailMock(...args),
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

import VerifyMemberEmailPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <VerifyMemberEmailPage />
    </NextIntlClientProvider>,
  );
}

describe('VerifyMemberEmailPage — distinta de VerifyEmailPage: sin link a /login, el miembro nunca entra a /app', () => {
  it('token válido: confirma, sin ofrecer ningún link (el miembro no tiene sesión)', async () => {
    (useParams as any).mockReturnValue({ token: 'tok-123' });
    verifyMemberEmailMock.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => expect(screen.getByText('Email confirmado — gracias.')).toBeInTheDocument());
    expect(verifyMemberEmailMock).toHaveBeenCalledWith('tok-123');
    // Único link es el logo (BrandMark) — a diferencia de VerifyEmailPage,
    // no hay "Ir a entrar" porque un miembro nunca tiene sesión.
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Ir a entrar')).not.toBeInTheDocument();
  });

  it('token inválido/caducado: muestra el mensaje real del backend', async () => {
    (useParams as any).mockReturnValue({ token: 'tok-malo' });
    verifyMemberEmailMock.mockRejectedValue(new ApiError(404, 'Enlace inválido'));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Enlace inválido'));
  });

  it('error que no es ApiError: cae en el mensaje genérico', async () => {
    (useParams as any).mockReturnValue({ token: 'tok-malo' });
    verifyMemberEmailMock.mockRejectedValue(new Error('network down'));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido o ha caducado.'));
  });
});
