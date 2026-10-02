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
  reminder_dow smallint not null default 5       -- día de la semana del recordatorio, para TODOS los equipos de la cuenta (0=domingo .. 6=sábado; 5=viernes)
    check (reminder_dow between 0 and 6),
  reminder_time time not null default '10:00',
  cutoff_time time not null default '13:00',     -- hora de corte para generar los informes, para todos los equipos
  timezone text not null default 'Europe/Madrid',
  language text not null default 'es'
    check (language in ('es', 'en')),           -- idioma de las preguntas/informes de esta cuenta, ver migración 0012 — independiente del idioma de la interfaz del panel (next-intl, por navegador)
  plan text not null default 'equipo'
    check (plan in ('equipo', 'organizacion', 'custom')),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'canceled')),
  max_teams integer,                             -- 1 (equipo) | 5 (organización) | NULL sin límite (custom)
  max_members_per_team integer,                  -- 10 (equipo) | 20 (organización) | NULL sin límite (custom)
  history_retention_months integer,              -- 1 (equipo) | 6 (organización) | NULL sin límite (custom) — ver migración 0013 y RetentionJob
  has_executive_summary boolean not null default false,
  executive_summary_recipients text[] not null default '{}', -- emails que reciben el resumen ejecutivo, ver migración 0009 y sección 6.4 del doc de producto
  price_month numeric(10,2),                     -- 49.00 | 149.00 | NULL (custom, a medida)
  stripe_customer_id text,
  stripe_subscription_id text,                   -- id de la suscripción activa en Stripe, ver migración 0002
  country text,                                  -- ISO 3166-1 alpha-2 ('ES', 'US', ...), ver migración 0004
  contact_name text,                             -- persona de contacto, ver migración 0005
  plan_selected boolean not null default false,  -- false hasta el primer Checkout de Stripe, ver migración 0016
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
  company_context text default '',              -- 2-3 líneas de contexto para el prompt de IA, sí es por equipo
  report_recipients text[] not null default '{}', -- emails que reciben el informe semanal DE ESTE equipo, ver migración 0009
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
  channel text not null default 'email'          -- 'email' | 'whatsapp' | 'telegram'
    check (channel in ('email', 'whatsapp', 'telegram')),
  contact text not null,                         -- email, teléfono E.164 (+34...) de WhatsApp o chat_id de Telegram
  active boolean not null default true,
  created_at timestamptz not null default now(),
  email_verified_at timestamptz                  -- solo para channel='email' — migración 0015
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
  raw_text text,                                  -- TODOS los mensajes de Telegram/WhatsApp de la semana, concatenados en orden de llegada (o su transcripción, si vinieron por nota de voz) — ver CheckinsService.appendIncoming, migración 0014
  done_text text,                                 -- "¿qué has hecho?" (si viene de un formulario con 3 campos)
  next_text text,                                 -- "¿qué harás la semana que viene?"
  blocker_text text,                              -- "¿algo bloqueado?"
  audio_paths text[] not null default '{}',       -- una entrada por nota de voz de la semana, en el bucket privado "checkin-audio" de Supabase Storage (antes un único audio_path, migración 0014)
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

-- ---------------------------------------------------------------------
-- surveys: encuesta anónima de un solo envío (no recurrente) — el admin
-- elige fecha, hora y timezone propios de ESTA encuesta desde
-- /app/survey/new, el cron la manda una vez y marca sent_at; nunca se
-- repite sola. Solo una pendiente (sent_at is null) por organización a
-- la vez, ver migración 0018.
-- ---------------------------------------------------------------------
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  questions text[] not null,                     -- hasta 5
  scheduled_date date not null,
  scheduled_time time not null,
  timezone text not null,
  sent_at timestamptz,                           -- null = todavía pendiente de mandar
  created_at timestamptz not null default now(),
  constraint surveys_questions_count check (
    array_length(questions, 1) between 1 and 5
  )
);

create unique index if not exists surveys_one_pending_per_org
  on surveys(organization_id) where sent_at is null;
create index if not exists idx_surveys_org on surveys(organization_id);

-- survey_submissions: marca "esta persona ya respondió ESTA encuesta",
-- SIN guardar qué contestó. survey_responses: el contenido, sin member_id
-- ni team_id de quien respondió — nada en la base de datos conecta una
-- persona con un contenido. Las dos cuelgan de survey_id (con cascade:
-- borrar una encuesta vieja se lleva sus respuestas/participaciones solas).
create table if not exists survey_submissions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (member_id, survey_id)
);

create index if not exists idx_survey_submissions_survey on survey_submissions(survey_id);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  questions text[] not null,                     -- copia de las preguntas de la encuesta al responder
  answers text[] not null,                        -- mismo orden que questions
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_survey on survey_responses(survey_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table organizations enable row level security;
alter table teams enable row level security;
alter table members enable row level security;
alter table checkins enable row level security;
alter table reports enable row level security;
alter table surveys enable row level security;
alter table survey_submissions enable row level security;
alter table survey_responses enable row level security;

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

create policy "owner puede ver y gestionar las encuestas de su organización"
  on surveys for all
  using (organization_id in (select id from organizations where owner_id = auth.uid()))
  with check (organization_id in (select id from organizations where owner_id = auth.uid()));

create policy "owner puede ver las participaciones de sus encuestas"
  on survey_submissions for select
  using (survey_id in (
    select id from surveys
    where organization_id in (select id from organizations where owner_id = auth.uid())
  ));

create policy "owner puede ver las respuestas anónimas de sus encuestas"
  on survey_responses for select
  using (survey_id in (
    select id from surveys
    where organization_id in (select id from organizations where owner_id = auth.uid())
  ));

-- Nota: los INSERT de checkins, reports y de las tablas de encuesta los
-- hace el backend con la service_role key (que salta RLS), no el usuario
-- final desde el navegador.
