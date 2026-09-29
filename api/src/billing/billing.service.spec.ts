import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { BillingService } from './billing.service';

const mockSubscriptionsRetrieve = jest.fn();
const mockSubscriptionsUpdate = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    subscriptions: { retrieve: mockSubscriptionsRetrieve, update: mockSubscriptionsUpdate },
  })),
);

// Mismo patrón de cola de respuestas que teams.service.spec.ts.
function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      update: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      in: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakeConfig(): ConfigService {
  const values: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_PRICE_EQUIPO: 'price_equipo',
    STRIPE_PRICE_ORGANIZACION: 'price_organizacion',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('BillingService — changePlan', () => {
  const orgId = 'org-1';

  beforeEach(() => {
    mockSubscriptionsRetrieve.mockReset();
    mockSubscriptionsUpdate.mockReset();
  });

  it('rechaza cambiar al plan en el que ya está', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'equipo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, error: null },
    ]);
    const service = new BillingService(fakeConfig(), supabase);

    await expect(service.changePlan(orgId, 'equipo', 'a@b.com')).rejects.toThrow(BadRequestException);
  });

  it('sin suscripción todavía, delega en createCheckoutSession (mismo camino que el alta)', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'equipo', stripe_customer_id: null, stripe_subscription_id: null }, error: null },
    ]);
    const service = new BillingService(fakeConfig(), supabase);
    const spy = jest.spyOn(service, 'createCheckoutSession').mockResolvedValue({ url: 'https://checkout.stripe.com/x' });

    const result = await service.changePlan(orgId, 'organizacion', 'a@b.com');

    expect(spy).toHaveBeenCalledWith(orgId, 'a@b.com', 'organizacion');
    expect(result).toEqual({ url: 'https://checkout.stripe.com/x' });
  });

  it('subir de plan termina el trial ya mismo y no toca los equipos', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'equipo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, error: null }, // organizations.select
      { data: null, error: null }, // organizations.update
    ]);
    mockSubscriptionsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    mockSubscriptionsUpdate.mockResolvedValue({});
    const service = new BillingService(fakeConfig(), supabase);

    const result = await service.changePlan(orgId, 'organizacion', 'a@b.com');

    expect(result).toEqual({ ok: true, isUpgrade: true });
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', price: 'price_organizacion' }],
        trial_end: 'now',
      }),
    );
    // from() solo se llamó dos veces (select + update) — nunca tocó teams.
    expect((supabase.db.from as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['organizations', 'organizations']);
  });

  it('bajar de plan borra los equipos más nuevos y deja solo el más antiguo', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'organizacion', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, error: null }, // organizations.select
      { data: null, error: null }, // organizations.update
      { data: [{ id: 'team-1' }, { id: 'team-2' }, { id: 'team-3' }], error: null }, // teams.select ordenado por created_at
      { data: null, error: null }, // teams.delete
    ]);
    mockSubscriptionsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    mockSubscriptionsUpdate.mockResolvedValue({});
    const service = new BillingService(fakeConfig(), supabase);

    const result = await service.changePlan(orgId, 'equipo', 'a@b.com');

    expect(result).toEqual({ ok: true, isUpgrade: false });
    // No se toca trial_end al bajar de plan.
    expect(mockSubscriptionsUpdate.mock.calls[0][1]).not.toHaveProperty('trial_end');

    const teamsBuilder = (supabase.db.from as jest.Mock).mock.results[3].value;
    expect(teamsBuilder.in).toHaveBeenCalledWith('id', ['team-2', 'team-3']);
  });

  it('bajar de plan desactiva resumen ejecutivo y encuesta mensual (Equipo no los admite)', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'organizacion', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, error: null },
      { data: null, error: null }, // organizations.update
      { data: [{ id: 'team-1' }], error: null },
    ]);
    mockSubscriptionsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    mockSubscriptionsUpdate.mockResolvedValue({});
    const service = new BillingService(fakeConfig(), supabase);

    await service.changePlan(orgId, 'equipo', 'a@b.com');

    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ has_executive_summary: false, has_monthly_survey: false }),
    );
  });

  it('si el update de organizations falla, no borra equipos (antes se perdían igual)', async () => {
    // Reproduce el bug real visto en producción: bajar a Equipo con el
    // resumen ejecutivo activo viola un check constraint de schema.sql
    // (org_exec_summary_plan_check) — Postgres rechaza el UPDATE. Antes el
    // error no se comprobaba y el borrado de equipos corría igual, con el
    // límite del plan nuevo aunque el plan nunca había cambiado de verdad.
    const dbError = { message: 'new row for relation "organizations" violates check constraint' };
    const supabase = fakeSupabase([
      { data: { plan: 'organizacion', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, error: null },
      { data: null, error: dbError }, // organizations.update falla
    ]);
    mockSubscriptionsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    mockSubscriptionsUpdate.mockResolvedValue({});
    const service = new BillingService(fakeConfig(), supabase);

    await expect(service.changePlan(orgId, 'equipo', 'a@b.com')).rejects.toEqual(dbError);

    // Nunca llegó a leer/borrar teams — solo 2 from() (select + update).
    expect((supabase.db.from as jest.Mock).mock.calls.length).toBe(2);
  });

  it('bajar de plan sin equipos de sobra no borra nada', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'organizacion', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, error: null },
      { data: null, error: null },
      { data: [{ id: 'team-1' }], error: null }, // ya tiene solo 1 equipo
    ]);
    mockSubscriptionsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    mockSubscriptionsUpdate.mockResolvedValue({});
    const service = new BillingService(fakeConfig(), supabase);

    await service.changePlan(orgId, 'equipo', 'a@b.com');

    // Nunca se llegó a llamar from('teams').delete() — solo 3 from() en total.
    expect((supabase.db.from as jest.Mock).mock.calls.length).toBe(3);
  });
});

describe('BillingService — handleEvent (checkout.session.completed)', () => {
  const orgId = 'org-1';

  function fakeSession(overrides: Record<string, any> = {}) {
    return {
      metadata: { organizationId: orgId, plan: 'equipo' },
      client_reference_id: orgId,
      customer: 'cus_1',
      subscription: 'sub_1',
      ...overrides,
    };
  }

  it('bug real de producción: baja a Equipo con el resumen ejecutivo activo — el update ahora lo desactiva en la misma llamada', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]); // organizations.update
    const service = new BillingService(fakeConfig(), supabase);

    await service.handleEvent({
      type: 'checkout.session.completed',
      data: { object: fakeSession() },
    } as any);

    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[0].value;
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'equipo', has_executive_summary: false, has_monthly_survey: false }),
    );
  });

  it('si el update viola una constraint (plan Equipo + resumen ejecutivo sin desactivar), lanza en vez de tragarse el error', async () => {
    // Antes de este fix, un error aquí se ignoraba: Stripe quedaba cobrando
    // el plan nuevo mientras la app se quedaba en el plan viejo, en
    // silencio — visto en vivo en la prueba E2E de producción.
    const dbError = { message: 'violates check constraint "org_exec_summary_plan_check"' };
    const supabase = fakeSupabase([{ data: null, error: dbError }]);
    const service = new BillingService(fakeConfig(), supabase);

    await expect(
      service.handleEvent({
        type: 'checkout.session.completed',
        data: { object: fakeSession() },
      } as any),
    ).rejects.toEqual(dbError);
  });
});
