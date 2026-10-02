import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { SupabaseService } from '../supabase/supabase.service';

export type BillingPlan = 'equipo' | 'organizacion';

// Límites por plan — reflejan mvp-resumen-semanal-equipos.md sección 11.
// El Plan Custom no se vende por Checkout (precio a medida, negociado
// aparte), así que solo Equipo y Organización pasan por Stripe.
const PLAN_CONFIG: Record<
  BillingPlan,
  { maxTeams: number; maxMembersPerTeam: number; priceMonth: number; historyRetentionMonths: number }
> = {
  equipo: { maxTeams: 1, maxMembersPerTeam: 10, priceMonth: 49, historyRetentionMonths: 1 },
  organizacion: { maxTeams: 5, maxMembersPerTeam: 20, priceMonth: 149, historyRetentionMonths: 6 },
};

// Orden de los planes de autoservicio, para saber si un cambio es subir o
// bajar de plan — Custom no entra aquí (alta gestionada a mano, nunca pasa
// por este flujo).
const PLAN_RANK: Record<BillingPlan, number> = { equipo: 1, organizacion: 2 };

// Trial con tarjeta: se pide la tarjeta en el Checkout (comportamiento por
// defecto de Stripe en modo subscription) pero no se cobra hasta que pasan
// estos días — Stripe cobra solo, sin que el backend tenga que hacer nada
// el día 30. Filtra curiosos sin tarjeta y no perdemos al cliente en la
// transición trial→pago porque ya está todo configurado desde el alta.
export const TRIAL_PERIOD_DAYS = 30;

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') ?? '');
  }

  private priceIdFor(plan: BillingPlan): string {
    const key = plan === 'equipo' ? 'STRIPE_PRICE_EQUIPO' : 'STRIPE_PRICE_ORGANIZACION';
    const priceId = this.config.get<string>(key);
    if (!priceId) throw new BadRequestException(`Falta configurar ${key} en el backend`);
    return priceId;
  }

  async getStatus(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .select('plan, status, price_month, max_teams, max_members_per_team, has_executive_summary, plan_selected')
      .eq('id', organizationId)
      .single();
    if (error) throw error;
    return data;
  }

  async createCheckoutSession(organizationId: string, email: string, plan: BillingPlan) {
    const { data: org, error } = await this.supabase.db
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!org) throw new NotFoundException('Organización no encontrada');

    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';

    // stripe_customer_id ya existía → esta organización ya tuvo una
    // suscripción antes (incluso si la canceló, nunca lo borramos). Sin esta
    // guarda, cancelar y volver a suscribirse regalaba otros 30 días gratis
    // cada vez — limitación conocida documentada en
    // docs/especificaciones-tecnicas.md, ahora cerrada.
    const isFirstSubscription = !org.stripe_customer_id;

    // Si ya existe stripe_customer_id lo reusamos (evita duplicar el
    // customer en Stripe en cada intento de suscripción/cambio de plan).
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.priceIdFor(plan), quantity: 1 }],
      customer: org.stripe_customer_id ?? undefined,
      customer_email: org.stripe_customer_id ? undefined : email,
      client_reference_id: organizationId,
      // Campo nativo "¿Tienes un código?" en la página de Stripe — códigos
      // promocionales únicos por cliente (X meses gratis, o gratis para
      // siempre) se crean en el dashboard de Stripe (Coupons → Promotion
      // codes), sin lógica de descuentos propia. Stripe valida el código,
      // aplica el descuento y no deja reusarlo si se limita a "1 use".
      allow_promotion_codes: true,
      // IVA automático por país del cliente (reverse-charge para empresas
      // de la UE con VAT ID válido, IVA local para consumidores) — requiere
      // tener el registro fiscal completo en el dashboard de Stripe
      // (Settings → Tax → Origin address + al menos una jurisdicción
      // registrada), si no la sesión falla al calcular el impuesto.
      automatic_tax: { enabled: true },
      metadata: { organizationId, plan },
      subscription_data: {
        ...(isFirstSubscription ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        metadata: { organizationId, plan },
      },
      success_url: `${baseUrl}/app/billing?checkout=success`,
      cancel_url: `${baseUrl}/app/billing?checkout=cancel`,
    });

    if (!session.url) throw new BadRequestException('No se pudo crear la sesión de pago');
    return { url: session.url };
  }

  // Cambio de plan para una organización que YA tiene una suscripción de
  // Stripe — a diferencia de createCheckoutSession (que crea una sesión de
  // pago nueva), esto modifica la suscripción existente en el sitio.
  // Crear una segunda sesión de Checkout con un customer que ya tiene
  // suscripción activa generaría una SEGUNDA suscripción en paralelo (Stripe
  // permite varias por customer) — se cobrarían las dos.
  //
  // Subir de plan (pedido explícito): termina el trial ya mismo
  // (`trial_end: 'now'`) y facturas la diferencia al momento
  // (`proration_behavior: 'always_invoice'`) — no se regalan más días
  // gratis solo por subir de plan a mitad de un trial.
  //
  // Bajar de plan (pedido explícito): la cuenta se queda solo con el
  // equipo más antiguo — el resto de equipos (y en cascada sus miembros,
  // checkins, informes y respuestas de encuesta) se borran. El aviso al
  // usuario de que esto va a pasar lo hace el frontend ANTES de llamar
  // aquí; este método ya asume que se confirmó.
  async changePlan(organizationId: string, newPlan: BillingPlan, email: string) {
    const { data: org, error } = await this.supabase.db
      .from('organizations')
      .select('id, plan, stripe_customer_id, stripe_subscription_id')
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!org) throw new NotFoundException('Organización no encontrada');

    // Sin suscripción todavía (registro sin terminar el checkout, o
    // checkout cancelado) — mismo camino que el alta normal, con trial.
    // Va ANTES del chequeo de "ya estás en ese plan": org.plan en este
    // punto es solo el límite de cortesía puesto al registrarse (siempre
    // 'equipo', ver AuthService.register), no una elección real — pedir
    // justo Equipo aquí no es "cambiar a lo mismo", es la primera elección.
    if (!org.stripe_subscription_id) {
      return this.createCheckoutSession(organizationId, email, newPlan);
    }

    if (org.plan === newPlan) throw new BadRequestException('Ya estás en ese plan');

    const isUpgrade = PLAN_RANK[newPlan] > PLAN_RANK[org.plan as BillingPlan];
    const planConfig = PLAN_CONFIG[newPlan];

    const subscription = await this.stripe.subscriptions.retrieve(org.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) throw new BadRequestException('No se pudo leer la suscripción en Stripe');

    await this.stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [{ id: itemId, price: this.priceIdFor(newPlan) }],
      proration_behavior: 'always_invoice',
      ...(isUpgrade ? { trial_end: 'now' } : {}),
      metadata: { organizationId, plan: newPlan },
    });

    const { error: updateError } = await this.supabase.db
      .from('organizations')
      .update({
        plan: newPlan,
        max_teams: planConfig.maxTeams,
        max_members_per_team: planConfig.maxMembersPerTeam,
        price_month: planConfig.priceMonth,
        history_retention_months: planConfig.historyRetentionMonths,
        plan_selected: true,
        // Igual que en handleEvent (checkout.session.completed): Plan
        // Equipo no admite resumen ejecutivo (constraint en schema.sql), y
        // esto tenía que ejecutarse ANTES del borrado de equipos de abajo —
        // si el update fallaba en silencio (error no comprobado) por
        // violar esa constraint, el borrado corría igual, usando el límite
        // del plan nuevo aunque el plan de la organización nunca había
        // cambiado de verdad: se perdían equipos sin que el cambio de plan
        // hubiera surtido efecto.
        ...(newPlan === 'equipo' ? { has_executive_summary: false } : {}),
      })
      .eq('id', organizationId);
    if (updateError) throw updateError;

    // La encuesta anónima tampoco está disponible en Plan Equipo. A
    // diferencia de has_executive_summary (un booleano de organizations),
    // vive en su propia tabla — sin este delete, una encuesta pendiente de
    // una cuenta que baja a Equipo igual se mandaría (SurveyJob no
    // comprueba el plan al enviar, solo SurveyService.createSurvey lo
    // comprueba al crearla).
    if (newPlan === 'equipo') {
      const { error: surveysError } = await this.supabase.db
        .from('surveys')
        .delete()
        .eq('organization_id', organizationId)
        .is('sent_at', null);
      if (surveysError) throw surveysError;
    }

    if (!isUpgrade) {
      const { data: teams, error: teamsError } = await this.supabase.db
        .from('teams')
        .select('id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });
      if (teamsError) throw teamsError;

      const teamsToDelete = (teams ?? []).slice(planConfig.maxTeams).map((t: any) => t.id);
      if (teamsToDelete.length > 0) {
        const { error: deleteError } = await this.supabase.db.from('teams').delete().in('id', teamsToDelete);
        if (deleteError) throw deleteError;
      }
    }

    return { ok: true, isUpgrade };
  }

  async createPortalSession(organizationId: string) {
    const { data: org, error } = await this.supabase.db
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!org?.stripe_customer_id) {
      throw new BadRequestException('Todavía no tienes una suscripción activa');
    }

    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${baseUrl}/app/billing`,
    });
    return { url: session.url };
  }

  // Aplicar un código promocional a una suscripción YA activa (el campo
  // nativo de Checkout solo cubre el alta) — el Billing Portal de Stripe no
  // trae un flujo propio para esto, así que se resuelve con dos llamadas:
  // buscar el promotion code por su texto y, si es válido, pisar los
  // discounts de la suscripción con él.
  async applyPromoCode(organizationId: string, code: string) {
    const { data: org, error } = await this.supabase.db
      .from('organizations')
      .select('stripe_subscription_id')
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!org?.stripe_subscription_id) {
      throw new BadRequestException('Todavía no tienes una suscripción activa');
    }

    const found = await this.stripe.promotionCodes.list({ code, active: true, limit: 1 });
    const promotionCode = found.data[0];
    if (!promotionCode) {
      throw new BadRequestException('Código inválido o ya no está activo');
    }

    await this.stripe.subscriptions.update(org.stripe_subscription_id, {
      discounts: [{ promotion_code: promotionCode.id }],
    });

    return { ok: true };
  }

  // El body debe llegar sin parsear (Buffer) — la firma de Stripe se
  // calcula sobre los bytes exactos que envió Stripe, ver main.ts.
  verifyWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new BadRequestException('STRIPE_WEBHOOK_SECRET no configurado');
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId ?? session.client_reference_id ?? undefined;
        const plan = (session.metadata?.plan as BillingPlan) ?? 'equipo';
        if (!organizationId) return;
        const planConfig = PLAN_CONFIG[plan] ?? PLAN_CONFIG.equipo;
        const { error: updateError } = await this.supabase.db
          .from('organizations')
          .update({
            status: 'active',
            plan,
            max_teams: planConfig.maxTeams,
            max_members_per_team: planConfig.maxMembersPerTeam,
            price_month: planConfig.priceMonth,
            history_retention_months: planConfig.historyRetentionMonths,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan_selected: true,
            // Plan Equipo no admite resumen ejecutivo
            // (org_exec_summary_plan_check en schema.sql) — sin esto, una
            // cuenta que baja a Equipo con resumen ejecutivo activado viola
            // la constraint, Postgres rechaza el UPDATE entero, y como
            // antes no se comprobaba el error, Stripe queda cobrando el
            // plan nuevo mientras la app se queda para siempre en el plan
            // viejo, en silencio. Visto en vivo en la prueba E2E de
            // producción (docs/pruebas-produccion.md).
            ...(plan === 'equipo' ? { has_executive_summary: false } : {}),
          })
          .eq('id', organizationId);
        if (updateError) throw updateError;

        // La encuesta anónima tampoco está disponible en Plan Equipo — ver
        // comentario equivalente en changePlan.
        if (plan === 'equipo') {
          const { error: surveysError } = await this.supabase.db
            .from('surveys')
            .delete()
            .eq('organization_id', organizationId)
            .is('sent_at', null);
          if (surveysError) throw surveysError;
        }
        return;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) return;
        const status = this.mapSubscriptionStatus(subscription.status);
        if (!status) return;
        await this.supabase.db.from('organizations').update({ status }).eq('id', organizationId);
        return;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) return;
        await this.supabase.db.from('organizations').update({ status: 'canceled' }).eq('id', organizationId);
        return;
      }
      default:
        return;
    }
  }

  private mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): 'active' | 'canceled' | null {
    if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
    if (stripeStatus === 'canceled' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired') return 'canceled';
    return null;
  }
}
