-- Retención del histórico por plan: cuánto tiempo se conservan checkins,
-- informes y respuestas de encuesta antes de que RetentionJob los borre.
-- NULL = sin límite (Custom). Se rellena al crear la cuenta según el plan
-- (igual que max_teams/max_members_per_team) y se actualiza al cambiar de
-- plan (BillingService).
alter table organizations
  add column if not exists history_retention_months integer;

update organizations set history_retention_months = 1 where plan = 'equipo';
update organizations set history_retention_months = 6 where plan = 'organizacion';
-- Custom se queda en NULL (sin límite) — ya es el valor por defecto de una columna nueva.
