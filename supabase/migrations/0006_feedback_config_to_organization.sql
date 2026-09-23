-- La configuración del "loop de feedback" (día/hora del recordatorio, hora
-- de corte y canal/destino donde llega el informe) pasa a ser de CUENTA,
-- no por equipo — decisión explícita: una empresa con varios equipos
-- quiere el mismo horario y el mismo destino para todos, no configurarlo
-- N veces. organizations.delivery_channel/delivery_target ya existían
-- (pensados para el resumen ejecutivo futuro) — se reutilizan como el
-- destino real de CADA informe de equipo, no solo del consolidado.
alter table organizations add column if not exists reminder_dow smallint
  check (reminder_dow between 0 and 6);
alter table organizations add column if not exists reminder_time time;
alter table organizations add column if not exists cutoff_time time;
alter table organizations add column if not exists timezone text;

-- Backfill: cada organización hereda el horario/destino de uno de sus
-- equipos existentes (dato real de desarrollo, no hay clientes en
-- producción todavía) — sin esto, las cuentas ya creadas se quedarían sin
-- recordatorio hasta que alguien entre a configurarlo a mano.
update organizations o
set
  reminder_dow = t.reminder_dow,
  reminder_time = t.reminder_time,
  cutoff_time = t.cutoff_time,
  timezone = t.timezone,
  delivery_target = coalesce(o.delivery_target, t.delivery_target)
from (
  select distinct on (organization_id) organization_id, reminder_dow, reminder_time, cutoff_time, timezone, delivery_target
  from teams
  order by organization_id, created_at asc
) t
where t.organization_id = o.id and o.reminder_dow is null;

-- Defaults + not null, una vez rellenado lo existente — mismos valores que
-- tenían antes las columnas equivalentes de teams.
update organizations set reminder_dow = 5 where reminder_dow is null;
update organizations set reminder_time = '10:00' where reminder_time is null;
update organizations set cutoff_time = '13:00' where cutoff_time is null;
update organizations set timezone = 'Europe/Madrid' where timezone is null;
alter table organizations alter column reminder_dow set default 5;
alter table organizations alter column reminder_time set default '10:00';
alter table organizations alter column cutoff_time set default '13:00';
alter table organizations alter column timezone set default 'Europe/Madrid';
alter table organizations alter column reminder_dow set not null;
alter table organizations alter column reminder_time set not null;
alter table organizations alter column cutoff_time set not null;
alter table organizations alter column timezone set not null;

-- Ya no se configuran por equipo.
alter table teams drop column if exists delivery_channel;
alter table teams drop column if exists delivery_target;
alter table teams drop column if exists reminder_dow;
alter table teams drop column if exists reminder_time;
alter table teams drop column if exists cutoff_time;
alter table teams drop column if exists timezone;
