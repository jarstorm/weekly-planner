import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../messages/es.json';

const registerMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api', () => ({
  // BrandMark usa useHomeHref, que llama a api.me() al montar.
  api: {
    register: (...args: unknown[]) => registerMock(...args),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
  ApiError: class ApiError extends Error {},
}));

// RegisterPage usa Link de next-intl (@/i18n/navigation) — fuera de un
// router de Next real, next-intl intenta resolver next/navigation y
// Vitest no lo encuentra (mismo problema que en AppShell.spec.tsx). Se
// mockea a un <a> normal, suficiente para lo que prueba este archivo.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import RegisterPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <RegisterPage />
    </NextIntlClientProvider>,
  );
}

function fillForm({ password = 'password123', confirm = 'password123' } = {}) {
  fireEvent.change(screen.getByLabelText('Nombre de la empresa'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

describe('RegisterPage — alta sin plan (el plan se elige después, en /app/billing)', () => {
  beforeEach(() => {
    registerMock.mockClear();
  });

  it('registra con los 3 campos de siempre, sin mandar ningún plan', async () => {
    renderPage();
    fillForm();

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
    expect(registerMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123', orgName: 'Acme' });
  });

  it('si las contraseñas no coinciden, no llama a la API y muestra el error', async () => {
    renderPage();
    fillForm({ password: 'password123', confirm: 'otraPassword' });

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('tras registrar, muestra la pantalla de "revisa tu email"', async () => {
    renderPage();
    fillForm();

    expect(await screen.findByText('Revisa tu email')).toBeInTheDocument();
  });
});
