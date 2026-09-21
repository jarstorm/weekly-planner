-- organizations.stripe_subscription_id: id de la suscripción activa en
-- Stripe (Checkout Session en modo subscription), para poder cancelarla
-- desde el Billing Portal o cruzarla con los eventos del webhook
-- (sección "Cobro con Stripe" del roadmap en docs/especificaciones-tecnicas.md).
alter table organizations add column if not exists stripe_subscription_id text;
