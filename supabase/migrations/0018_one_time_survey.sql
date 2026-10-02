-- La encuesta anónima deja de ser "recurrente mensual" (has_monthly_survey +
-- survey_questions + survey_day_of_month en organizations, un solo horario
-- de cuenta reutilizado mes tras mes) y pasa a ser "se crea una vez, se
-- manda una vez": el admin elige fecha, hora y timezone propios de ESA
-- encuesta (no los del recordatorio semanal) desde /app/survey/new, y el
-- cron la manda y la marca como enviada — nunca se repite sola. Pedido
-- explícito: la UI anterior daba la impresión de que la misma configuración
-- se repetía cada mes, que no era la intención real.
--
-- Solo una encuesta pendiente (sent_at is null) por organización a la vez
-- — decisión explícita para no complicar la UI con una lista de pendientes
-- que se puedan solapar o cancelar entre sí.
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  questions text[] not null,
  scheduled_date date not null,
  scheduled_time time not null,
  timezone text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint surveys_questions_count check (
    array_length(questions, 1) between 1 and 5
  )
);

create unique index if not exists surveys_one_pending_per_org
  on surveys(organization_id) where sent_at is null;

create index if not exists idx_surveys_org on surveys(organization_id);

-- Las respuestas/participaciones del modelo recurrente viejo no tienen
-- ninguna encuesta de la tabla nueva a la que apuntar (surveys arranca
-- vacía) — se borran antes de añadir survey_id NOT NULL. Solo existían en
-- la cuenta de pruebas (ninguna organización real tenía esto activado
-- todavía), así que no hay nada que migrar de verdad.
delete from survey_responses;
delete from survey_submissions;

-- survey_submissions/survey_responses pasan de "período" (primer día del
-- mes) a apuntar a la encuesta concreta que respondieron — con el on delete
-- cascade, borrar una encuesta vieja (RetentionJob) se lleva sus
-- respuestas/participaciones sin un segundo delete aparte.
alter table survey_submissions add column if not exists survey_id uuid references surveys(id) on delete cascade;
alter table survey_responses add column if not exists survey_id uuid references surveys(id) on delete cascade;

drop index if exists idx_survey_submissions_org_period;
drop index if exists idx_survey_responses_org_period;

alter table survey_submissions drop constraint if exists survey_submissions_member_id_period_key;
alter table survey_submissions drop column if exists period;
alter table survey_responses drop column if exists period;

alter table survey_submissions alter column survey_id set not null;
alter table survey_responses alter column survey_id set not null;

alter table survey_submissions add constraint survey_submissions_member_survey_unique unique (member_id, survey_id);

create index if not exists idx_survey_submissions_survey on survey_submissions(survey_id);
create index if not exists idx_survey_responses_survey on survey_responses(survey_id);

-- Las políticas RLS viejas de estas dos tablas usan organization_id en su
-- USING — hay que soltarlas ANTES de poder borrar la columna, si no
-- Postgres rechaza el drop ("other objects depend on it").
drop policy if exists "owner puede ver las participaciones de su organización" on survey_submissions;
drop policy if exists "owner puede ver las respuestas anónimas de su organización" on survey_responses;

-- Ya no hace falta organization_id en estas dos tablas — se llega a la
-- organización a través de survey_id → surveys.organization_id, y
-- mantenerlo abría la puerta a que se desincronizara del de la encuesta.
alter table survey_submissions drop column if exists organization_id;
alter table survey_responses drop column if exists organization_id;

alter table surveys enable row level security;

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

-- La disponibilidad por plan (antes org_survey_plan_check, un constraint
-- de organizations) se comprueba ahora en SurveyService.createSurvey —
-- no hay forma limpia de expresar "el plan de la organización referenciada"
-- como check constraint de otra tabla sin un trigger, y la app ya valida
-- el resto de reglas de plan (límites de equipos/miembros) en esa capa.
alter table organizations drop constraint if exists org_survey_plan_check;
alter table organizations drop constraint if exists org_survey_questions_max;
alter table organizations drop column if exists has_monthly_survey;
alter table organizations drop column if exists survey_questions;
alter table organizations drop column if exists survey_day_of_month;
