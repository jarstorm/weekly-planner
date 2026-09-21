-- =====================================================================
-- WeeklyFeedback — esquema de base de datos (Supabase / Postgres)
-- Corresponde al modelo de datos descrito en docs/mvp-resumen-semanal-equipos.md
-- Ejecutar en el SQL editor de Supabase, o con `supabase db push`.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- organizations: la cuenta que paga. TODO cliente tiene una fila aquí,
-- incluso el Plan Equipo (una empresa con un solo equipo sigue siendo
-- una "organization" de un equipo) — así los límites y la facturación
-- se gestionan en un único sitio para los 3 planes.
--
-- plan       → el NIVEL contratado: qué límites tiene y qué funciones
--              incluye. Es independiente de si está pagando ahora mismo.
-- status     → el ESTADO de la suscripción (trial/active/canceled).
--              Antes vivía mezclado dentro de la misma columna "plan";
--              separarlos evita el sinsentido de "plan = active" no
--              decir nada sobre si es Equipo u Organización.
-- max_teams / max_members_per_team → límites del plan. NULL = sin límite
--              (solo se da en Plan Custom).
-- has_executive_summary → si esta cuenta tiene activado el informe
--              consolidado ("resumen ejecutivo"). Es una OPCIÓN
--              disponible para Organización y Custom — no viene forzada
--              a true solo por estar en esos planes (una organización
--              con 2 equipos puede no quererlo todavía), y nunca está
--              disponible en Plan Equipo (con un solo equipo no hay
--              nada que consolidar).
-- price_month → precio mensual sin IVA. NULL en Plan Custom porque es
--              precio a medida, negociado caso por caso.
-- ---------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  delivery_channel text not null default 'email' -- dónde llega el informe CONSOLIDADO, si aplica
    check (delivery_channel in ('email', 'whatsapp')),
  delivery_target text,                          -- normalmente quien dirige la empresa
  plan text not null default 'equipo'
    check (plan in ('equipo', 'organizacion', 'custom')),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'canceled')),
  max_teams integer,                             -- 1 (equipo) | 5 (organización) | NULL sin límite (custom)
  max_members_per_team integer,                  -- 20 (equipo/organización) | NULL sin límite (custom)
  has_executive_summary boolean not null default false,
  price_month numeric(10,2),                     -- 49.00 | 149.00 | NULL (custom, a medida)
  stripe_customer_id text,
  created_at timestamptz not null default now(),

  -- el resumen ejecutivo nunca puede activarse en Plan Equipo
  constraint org_exec_summary_plan_check check (
    not has_executive_summary or plan in ('organizacion', 'custom')
  )
);

-- Nota de diseño: max_teams y max_members_per_team se rellenan al crear
-- la cuenta según el plan contratado (equipo → 1/20, organización → 5/20,
-- custom → NULL/NULL o los valores negociados) y se validan en la capa de
-- aplicación al dar de alta un equipo o un miembro nuevo — no hay
-- trigger en base de datos para esto en el MVP.

-- ---------------------------------------------------------------------
-- teams: un equipo = un ciclo de check-ins independiente.
-- Todo equipo pertenece a una organization (incluso en Plan Equipo, que
-- simplemente tiene una organization con un único team).
-- ---------------------------------------------------------------------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  company_context text default '',              -- 2-3 líneas de contexto para el prompt de IA
  delivery_channel text not null default 'email' -- 'email' | 'whatsapp' | 'telegram' (temporal MVP, ver docs/especificaciones-tecnicas.md sección 0.2)
    check (delivery_channel in ('email', 'whatsapp', 'telegram')),
  delivery_target text,                          -- email, número de WhatsApp o chat_id de Telegram donde llega el informe de ESTE equipo
  reminder_dow smallint not null default 5       -- día de la semana del recordatorio (0=domingo .. 6=sábado; 5=viernes)
    check (reminder_dow between 0 and 6),
  reminder_time time not null default '10:00',
  cutoff_time time not null default '13:00',     -- hora de corte para generar el informe de equipo
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_org on teams(organization_id);

-- Nota de diseño: dentro de una misma organización, todos los equipos deben
-- compartir reminder_dow y cutoff_time (se valida en la capa de aplicación,
-- no aquí) — así el informe consolidado se puede generar en cuanto el último
-- equipo llega a su hora de corte, sin tener que esperar días distintos.

-- ---------------------------------------------------------------------
-- members: personas del equipo que reciben la pregunta semanal
-- ---------------------------------------------------------------------
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  channel text not null default 'email'          -- 'email' | 'whatsapp' | 'telegram' (temporal MVP, ver docs/especificaciones-tecnicas.md sección 0.2)
    check (channel in ('email', 'whatsapp', 'telegram')),
  contact text not null,                         -- email, teléfono E.164 (+34...) o chat_id de Telegram
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_team on members(team_id);

-- ---------------------------------------------------------------------
-- checkins: la respuesta individual de una persona en una semana concreta
-- ---------------------------------------------------------------------
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  week_start date not null,                      -- lunes de la semana correspondiente
  raw_text text,                                  -- mensaje único de WhatsApp/email sin estructurar (o transcripción, si vino por nota de voz)
  done_text text,                                 -- "¿qué has hecho?" (si viene de un formulario con 3 campos)
  next_text text,                                 -- "¿qué harás la semana que viene?"
  blocker_text text,                              -- "¿algo bloqueado?"
  audio_path text,                                -- path en el bucket privado "checkin-audio" de Supabase Storage, si el checkin vino por nota de voz (ver docs/especificaciones-tecnicas.md, sección 0.7)
  received_at timestamptz not null default now(),
  unique (member_id, week_start)
);

create index if not exists idx_checkins_team_week on checkins(team_id, week_start);

-- ---------------------------------------------------------------------
-- reports: el informe que genera la IA cada semana — de UN equipo,
-- o el informe CONSOLIDADO ("resumen ejecutivo") de una organización
-- entera (nunca las dos cosas). El consolidado solo se genera si la
-- organización tiene has_executive_summary = true (Organización/Custom).
-- ---------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  week_start date not null,
  content_markdown text,
  blockers_detected jsonb not null default '[]', -- ["bloqueo X lleva 3 semanas", ...]
  source_report_ids uuid[] default '{}',          -- solo en informes de organización: qué informes de equipo lo componen
  generated_at timestamptz,
  delivered_at timestamptz,
  constraint reports_scope_check check (
    (team_id is not null and organization_id is null) or
    (team_id is null and organization_id is not null)
  )
);

create unique index if not exists reports_team_week_unique
  on reports(team_id, week_start) where team_id is not null;
create unique index if not exists reports_org_week_unique
  on reports(organization_id, week_start) where organization_id is not null;
create index if not exists idx_reports_org_week on reports(organization_id, week_start);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table organizations enable row level security;
alter table teams enable row level security;
alter table members enable row level security;
alter table checkins enable row level security;
alter table reports enable row level security;

create policy "owner puede ver y editar su cuenta"
  on organizations for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner puede ver y editar sus equipos"
  on teams for all
  using (organization_id in (select id from organizations where owner_id = auth.uid()))
  with check (organization_id in (select id from organizations where owner_id = auth.uid()));

create policy "owner puede gestionar los miembros de sus equipos"
  on members for all
  using (team_id in (
    select id from teams
    where organization_id in (select id from organizations where owner_id = auth.uid())
  ))
  with check (team_id in (
    select id from teams
    where organization_id in (select id from organizations where owner_id = auth.uid())
  ));

create policy "owner puede ver los checkins de sus equipos"
  on checkins for select
  using (team_id in (
    select id from teams
    where organization_id in (select id from organizations where owner_id = auth.uid())
  ));

create policy "owner puede ver los informes de sus equipos y su organización"
  on reports for select
  using (
    team_id in (
      select id from teams
      where organization_id in (select id from organizations where owner_id = auth.uid())
    )
    or organization_id in (select id from organizations where owner_id = auth.uid())
  );

-- Nota: los INSERT de checkins y reports los hace el backend con la
-- service_role key (que salta RLS), no el usuario final desde el navegador.
