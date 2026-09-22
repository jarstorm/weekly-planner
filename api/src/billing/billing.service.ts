import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { SupabaseService } from '../supabase/supabase.service';

export type BillingPlan = 'equipo' | 'organizacion';

// Límites por plan — reflejan mvp-resumen-semanal-equipos.md sección 11.
// El Plan Custom no se vende por Checkout (precio a medida, negociado
// aparte), así que solo Equipo y Organización pasan por Stripe.
const PLAN_CONFIG: Record<BillingPlan, { maxTeams: number; maxMembersPerTeam: number; priceMonth: number }> = {
  equipo: { maxTeams: 1, maxMembersPerTeam: 20, priceMonth: 49 },
  organizacion: { maxTeams: 5, maxMembersPerTeam: 20, priceMonth: 149 },
};

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
      .select('plan, status, price_month, max_teams, max_members_per_team, has_executive_summary')
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

    // Si ya existe stripe_customer_id lo reusamos (evita duplicar el
    // customer en Stripe en cada intento de suscripción/cambio de plan).
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.priceIdFor(plan), quantity: 1 }],
      customer: org.stripe_customer_id ?? undefined,
      customer_email: org.stripe_customer_id ? undefined : email,
      client_reference_id: organizationId,
      metadata: { organizationId, plan },
      subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS, metadata: { organizationId, plan } },
      success_url: `${baseUrl}/app/billing?checkout=success`,
      cancel_url: `${baseUrl}/app/billing?checkout=cancel`,
    });

    if (!session.url) throw new BadRequestException('No se pudo crear la sesión de pago');
    return { url: session.url };
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
        await this.supabase.db
          .from('organizations')
          .update({
            status: 'active',
            plan,
            max_teams: planConfig.maxTeams,
            max_members_per_team: planConfig.maxMembersPerTeam,
            price_month: planConfig.priceMonth,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('id', organizationId);
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
