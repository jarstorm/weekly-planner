-- El registro ya no elige plan ni pasa por Stripe — crea la cuenta con un
-- límite mínimo de cortesía (igual que Plan Equipo) y plan_selected en
-- false. El primer login fuerza pasar por /app/billing (AppShell) hasta
-- que BillingService.handleEvent (checkout.session.completed) o
-- BillingService.changePlan la pongan en true — ver auth.service.ts.
alter table organizations add column if not exists plan_selected boolean not null default false;
