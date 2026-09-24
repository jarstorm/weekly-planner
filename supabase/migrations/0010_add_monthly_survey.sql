-- Roadmap: encuesta mensual anónima, opción de Plan Organización/Custom
-- (mismo criterio que has_executive_summary, migración 0009) — de cuenta,
-- no por equipo: una única lista de hasta 5 preguntas para toda la
-- organización, mandada el mismo día del mes a todos los miembros activos
-- de todos sus equipos.
alter table organizations
  add column if not exists has_monthly_survey boolean not null default false,
  add column if not exists survey_questions text[] not null default '{}',
  add column if not exists survey_day_of_month smallint not null default 1
    check (survey_day_of_month between 1 and 28);

alter table organizations
  add constraint org_survey_plan_check check (
    not has_monthly_survey or plan in ('organizacion', 'custom')
  );

alter table organizations
  add constraint org_survey_questions_max check (
    array_length(survey_questions, 1) is null or array_length(survey_questions, 1) <= 5
  );

-- survey_submissions: marca "esta persona ya respondió este mes", SIN
-- guardar qué contestó — existe solo para no mandar el recordatorio dos
-- veces ni dejar contestar dos veces. No lleva relación hacia
-- survey_responses a propósito: es lo que hace la respuesta anónima de
-- verdad (nada en la base de datos conecta un member_id con un contenido).
create table if not exists survey_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  period date not null,                          -- primer día del mes correspondiente
  submitted_at timestamptz not null default now(),
  unique (member_id, period)
);

create index if not exists idx_survey_submissions_org_period on survey_submissions(organization_id, period);

-- survey_responses: el contenido, sin member_id ni team_id de la persona
-- que respondió — solo a qué organización pertenece y de qué mes es.
-- `questions` guarda una copia de las preguntas vigentes en el momento de
-- la respuesta (si el admin edita las preguntas a mitad de mes, las
-- respuestas ya guardadas no cambian de sentido) y `answers` va en el
-- mismo orden.
create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  period date not null,
  questions text[] not null,
  answers text[] not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_org_period on survey_responses(organization_id, period);

alter table survey_submissions enable row level security;
alter table survey_responses enable row level security;

-- El owner puede ver QUIÉN respondió (para saber el % de participación),
-- nunca QUÉ respondió — esa tabla no tiene contenido, ver comentario arriba.
create policy "owner puede ver las participaciones de su organización"
  on survey_submissions for select
  using (organization_id in (select id from organizations where owner_id = auth.uid()));

create policy "owner puede ver las respuestas anónimas de su organización"
  on survey_responses for select
  using (organization_id in (select id from organizations where owner_id = auth.uid()));

-- Nota: los INSERT de survey_submissions/survey_responses los hace el
-- backend con la service_role key (salta RLS), igual que checkins/reports.
