import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../messages/es.json';

const replaceMock = vi.fn();
const pushMock = vi.fn();
let currentPathname = '/app';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const billingStatusMock = vi.fn();
vi.mock('@/lib/api', () => ({
  // BrandMark usa useHomeHref, que llama a api.me() al montar — sin esto
  // el componente revienta en el test aunque no sea lo que se prueba acá.
  api: {
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <AppShell>contenido</AppShell>
    </NextIntlClientProvider>,
  );
}

describe('AppShell — wizard de plan tras el login', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    billingStatusMock.mockReset();
    currentPathname = '/app';
  });

  it('con plan_selected en false, redirige a /app/billing', async () => {
    billingStatusMock.mockResolvedValue({ plan_selected: false });
    renderShell();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/app/billing'));
  });

  it('con plan_selected en true, no redirige', async () => {
    billingStatusMock.mockResolvedValue({ plan_selected: true });
    renderShell();

    await waitFor(() => expect(billingStatusMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('ya en /app/billing, no vuelve a comprobar ni a redirigir (evita bucle)', async () => {
    currentPathname = '/app/billing';
    billingStatusMock.mockResolvedValue({ plan_selected: false });
    renderShell();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(billingStatusMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('si falla la comprobación (p.ej. sesión caducada), no redirige ni rompe — cada página maneja su 401', async () => {
    billingStatusMock.mockRejectedValue(new Error('401'));
    renderShell();

    await waitFor(() => expect(billingStatusMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
