import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const meMock = vi.fn().mockResolvedValue({ userId: 'u-1', email: 'a@b.com', organizationId: 'org-1' });
const billingStatusMock = vi.fn();
const changePlanMock = vi.fn();
const createPortalSessionMock = vi.fn();
const applyPromoCodeMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({ useSearchParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/billing',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    me: (...args: unknown[]) => meMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    changePlan: (...args: unknown[]) => changePlanMock(...args),
    createPortalSession: (...args: unknown[]) => createPortalSessionMock(...args),
    applyPromoCode: (...args: unknown[]) => applyPromoCodeMock(...args),
    logout: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import BillingPage from './page';

function status(overrides: Partial<{ plan: 'equipo' | 'organizacion' | 'custom'; status: 'trial' | 'active' | 'canceled'; price_month: number | null; plan_selected: boolean }> = {}) {
  return {
    plan: 'equipo' as const,
    status: 'trial' as const,
    price_month: 49,
    max_teams: 1,
    max_members_per_team: 10,
    has_executive_summary: false,
    plan_selected: true,
    ...overrides,
  };
}

function renderPage(query: Record<string, string> = {}) {
  (useSearchParams as any).mockReturnValue({ get: (key: string) => query[key] ?? null });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <BillingPage />
    </NextIntlClientProvider>,
  );
}

const originalLocation = window.location;

beforeEach(() => {
  // mockReset + volver a fijar el resuelto por defecto — "sesión caducada"
  // deja meMock en rechazo permanente (mockRejectedValue sin "Once"); un
  // mockClear no lo revertía, así que todos los tests posteriores heredaban
  // ese rechazo y nunca llegaban a billingStatus().
  meMock.mockReset().mockResolvedValue({ userId: 'u-1', email: 'a@b.com', organizationId: 'org-1' });
  billingStatusMock.mockReset();
  changePlanMock.mockReset();
  createPortalSessionMock.mockReset();
  applyPromoCodeMock.mockReset();
  pushMock.mockClear();
  (trackEvent as any).mockClear();
  // @ts-expect-error jsdom no navega de verdad — se reemplaza por un objeto
  // simple para poder comprobar a dónde se quiso redirigir sin que jsdom
  // imprima "Not implemented: navigation".
  delete (window as any).location;
  (window as any).location = { href: '' };
});

afterEach(() => {
  (window as any).location = originalLocation;
});

describe('BillingPage — carga', () => {
  it('sesión caducada (401 en /auth/me o /billing/status): redirige a /login, no muestra error genérico', async () => {
    meMock.mockRejectedValue(new ApiError(401, 'Sesión inválida o expirada'));
    renderPage();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('otro fallo (backend caído): muestra el error genérico, no redirige', async () => {
    meMock.mockRejectedValue(new Error('network down'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el estado de la suscripción'));
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe('BillingPage — en trial: suscribirse va directo a Stripe Checkout, sin confirmar', () => {
  beforeEach(() => {
    billingStatusMock.mockResolvedValue(status({ status: 'trial', plan_selected: false }));
  });

  it('elegir un plan trackea plan_select y redirige a la URL de Stripe, sin modal de confirmación', async () => {
    changePlanMock.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Elige tu plan')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Suscribirse')[0]);

    expect(trackEvent).toHaveBeenCalledWith('plan_select', { plan: 'equipo', context: 'billing' });
    expect(screen.queryByText('Sí, cambiar de plan')).not.toBeInTheDocument();
    await waitFor(() => expect((window as any).location.href).toBe('https://checkout.stripe.com/c/pay/cs_test_123'));
  });

  it('fallo iniciando el checkout: muestra el error de acción', async () => {
    changePlanMock.mockRejectedValue(new Error('stripe down'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Elige tu plan')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Suscribirse')[0]);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo iniciar el pago, prueba de nuevo'));
  });
});

describe('BillingPage — con suscripción activa: cambiar de plan se confirma antes', () => {
  beforeEach(() => {
    billingStatusMock.mockResolvedValue(status({ plan: 'equipo', status: 'active', plan_selected: true }));
  });

  it('subir de plan (Equipo → Organización) muestra el aviso de upgrade, no el de downgrade', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tu plan actual')).toBeInTheDocument());

    const subscribeButtons = screen.getAllByText('Suscribirse');
    fireEvent.click(subscribeButtons[0]); // el único "Suscribirse" visible es el de Organización (Equipo ya es el actual)

    expect(screen.getByText(/Vas a cambiar al Plan Organización/)).toBeInTheDocument();
    expect(screen.queryByText(/te quedarás solo con tu equipo más antiguo/)).not.toBeInTheDocument();
  });

  it('confirmar el cambio sin "url" en la respuesta (ya suscripto) refresca el estado y cierra el modal', async () => {
    changePlanMock.mockResolvedValue({ ok: true, isUpgrade: true });
    billingStatusMock
      .mockResolvedValueOnce(status({ plan: 'equipo', status: 'active', plan_selected: true }))
      .mockResolvedValueOnce(status({ plan: 'organizacion', status: 'active', plan_selected: true }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Tu plan actual')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Suscribirse')[0]);
    fireEvent.click(screen.getByText('Sí, cambiar de plan'));

    await waitFor(() => expect(screen.queryByText('Sí, cambiar de plan')).not.toBeInTheDocument());
    expect(trackEvent).toHaveBeenCalledWith('plan_change', { plan: 'organizacion' });
  });

  it('cancelar el modal de confirmación no llama a changePlan', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tu plan actual')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Suscribirse')[0]);
    fireEvent.click(screen.getByText('Cancelar'));

    expect(screen.queryByText(/Vas a cambiar al/)).not.toBeInTheDocument();
    expect(changePlanMock).not.toHaveBeenCalled();
  });

  it('clicar fuera del modal (overlay) también cancela, salvo que ya esté procesando', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tu plan actual')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Suscribirse')[0]);
    fireEvent.click(document.querySelector('.modal-overlay')!);

    expect(screen.queryByText(/Vas a cambiar al/)).not.toBeInTheDocument();
  });

  it('gestionar suscripción (portal de Stripe): trackea y redirige', async () => {
    createPortalSessionMock.mockResolvedValue({ url: 'https://billing.stripe.com/session/abc' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Gestionar suscripción')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Gestionar suscripción'));

    await waitFor(() => expect((window as any).location.href).toBe('https://billing.stripe.com/session/abc'));
    expect(trackEvent).toHaveBeenCalledWith('billing_portal_open');
  });

  it('fallo abriendo el portal: muestra el error', async () => {
    createPortalSessionMock.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Gestionar suscripción')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Gestionar suscripción'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo abrir la gestión de la suscripción'));
  });

  it('código promocional: éxito limpia el campo y muestra el aviso, trackea el evento', async () => {
    applyPromoCodeMock.mockResolvedValue({ ok: true });
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('Código promocional')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Código promocional'), { target: { value: 'DESCUENTO50' } });
    fireEvent.click(screen.getByText('Aplicar'));

    await waitFor(() => expect(screen.getByText('Código aplicado. El descuento se verá reflejado en tu próxima factura.')).toBeInTheDocument());
    expect(applyPromoCodeMock).toHaveBeenCalledWith('DESCUENTO50');
    expect(trackEvent).toHaveBeenCalledWith('promo_code_apply');
    expect((screen.getByPlaceholderText('Código promocional') as HTMLInputElement).value).toBe('');
  });

  it('código promocional inválido: muestra el mensaje real del backend', async () => {
    applyPromoCodeMock.mockRejectedValue(new ApiError(404, 'Código no válido'));
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('Código promocional')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Código promocional'), { target: { value: 'FALSO' } });
    fireEvent.click(screen.getByText('Aplicar'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Código no válido'));
  });
});

describe('BillingPage — sin suscripción activa (trial): sin portal ni promo-code', () => {
  it('en trial no se ofrece "Gestionar suscripción" ni código promocional (hace falta stripe_subscription_id)', async () => {
    billingStatusMock.mockResolvedValue(status({ status: 'trial', plan_selected: true }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/En periodo de prueba/)).toBeInTheDocument());
    expect(screen.queryByText('Gestionar suscripción')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Código promocional')).not.toBeInTheDocument();
  });

  it('muestra el aviso de los 30 días de trial', async () => {
    billingStatusMock.mockResolvedValue(status({ status: 'trial', plan_selected: true }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/30 días de prueba gratis/)).toBeInTheDocument());
  });
});

describe('BillingPage — checkout de vuelta desde Stripe', () => {
  it('?checkout=success: ofrece crear el primer equipo', async () => {
    billingStatusMock.mockResolvedValue(status({ plan_selected: true }));
    renderPage({ checkout: 'success' });

    await waitFor(() => expect(screen.getByText('¡Pago confirmado! Tu suscripción ya está activa.')).toBeInTheDocument());
    expect(screen.getByText('Crear tu primer equipo').closest('a')).toHaveAttribute('href', '/app/onboarding');
  });

  it('?checkout=cancel: avisa que no se cobró nada', async () => {
    billingStatusMock.mockResolvedValue(status({ plan_selected: false }));
    renderPage({ checkout: 'cancel' });

    await waitFor(() => expect(screen.getByText('Pago cancelado, no se hizo ningún cargo.')).toBeInTheDocument());
  });
});
