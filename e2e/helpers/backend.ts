import { spawnSync } from 'child_process';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { API_DIR, API_URL, TIMEZONE, required } from './env';

// Los tokens se firman con el mismo código del backend compilado, no con
// una copia — si cambia el formato, el e2e lo sigue.
const dist = (p: string) => require(path.join(API_DIR, 'dist', p));

export const db = () => createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
export const stripe = () => new Stripe(required('STRIPE_SECRET_KEY'));

export function runJob(job: 'reminder' | 'report' | 'survey') {
  const res = spawnSync('node', [path.join(__dirname, 'run-job.cjs'), job], {
    cwd: API_DIR,
    encoding: 'utf-8',
    env: process.env,
  });
  if (res.status !== 0) throw new Error(`Job ${job} falló:\n${res.stdout}\n${res.stderr}`);
  return res.stdout + res.stderr;
}

export function currentWeekStart(): string {
  return dist('jobs/date.utils').currentWeekStart(new Date(), TIMEZONE);
}

export function emailVerifyToken(userId: string): string {
  return dist('auth/verify-email-token.util').signEmailVerificationToken(userId, required('EMAIL_VERIFICATION_TOKEN_SECRET'));
}

export function checkinToken(memberId: string, weekStart: string): string {
  return dist('checkin-form/token.util').signCheckinToken({ memberId, weekStart }, required('CHECKIN_TOKEN_SECRET'));
}

export function surveyToken(memberId: string, surveyId: string): string {
  return dist('survey/token.util').signSurveyToken({ memberId, surveyId }, required('SURVEY_TOKEN_SECRET'));
}

// El webhook real de Stripe no puede llegar a un backend en localhost, así
// que se reproduce: se lee de Stripe la sesión de Checkout REAL que acaba de
// pagarse y se manda al endpoint del backend firmada con STRIPE_WEBHOOK_SECRET
// (misma verificación que en producción).
export async function sendCheckoutCompletedWebhook(organizationId: string) {
  const s = stripe();
  const sessions = await s.checkout.sessions.list({ limit: 20 });
  const session = sessions.data.find((x) => x.client_reference_id === organizationId && x.status === 'complete');
  if (!session) throw new Error('Stripe no tiene ninguna sesión de Checkout completada para esta organización');

  const payload = JSON.stringify({
    id: `evt_e2e_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: session },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: required('STRIPE_WEBHOOK_SECRET') });
  const res = await fetch(`${API_URL}/webhooks/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
  if (!res.ok) throw new Error(`Webhook rechazado: ${res.status} ${await res.text()}`);
  return session;
}

export async function cleanup(email: string, organizationId?: string) {
  const supabase = db();
  const s = stripe();

  if (organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', organizationId)
      .maybeSingle();
    if (org?.stripe_subscription_id) await s.subscriptions.cancel(org.stripe_subscription_id).catch(() => {});
    if (org?.stripe_customer_id) await s.customers.del(org.stripe_customer_id).catch(() => {});
    await supabase.from('organizations').delete().eq('id', organizationId);
  }

  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.users.find((u) => u.email === email);
  if (user) await supabase.auth.admin.deleteUser(user.id);
}
