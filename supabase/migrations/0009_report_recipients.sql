-- Paso 15 (resumen ejecutivo) + lista de destinatarios por informe, ver
-- docs/especificaciones-tecnicas.md sección 0.2/0.12 y
-- docs/mvp-resumen-semanal-equipos.md sección 6.4.
--
-- Antes (migración 0006): un único destino de cuenta
-- (organizations.delivery_channel/delivery_target) recibía TODOS los
-- informes de equipo. Con más de un equipo eso no tiene sentido — cada
-- equipo puede tener un responsable distinto. Pasa a ser una lista de
-- emails por equipo. Siempre email, sin selector de canal por
-- destinatario (decisión explícita, simplifica).
alter table teams add column if not exists report_recipients text[] not null default '{}';

-- Backfill: solo si el destino de cuenta ya era email — un delivery_target
-- de telegram/whatsapp no es un email válido para la nueva lista, y no hay
-- clientes reales en producción todavía (mismo criterio que la migración
-- 0003), así que no se migra: hay que configurar el destinatario real a
-- mano en la ficha de cada equipo.
update teams t
set report_recipients = array[o.delivery_target]
from organizations o
where t.organization_id = o.id
  and o.delivery_channel = 'email'
  and o.delivery_target is not null
  and t.report_recipients = '{}';

alter table organizations add column if not exists executive_summary_recipients text[] not null default '{}';

-- delivery_channel/delivery_target quedan obsoletos: reemplazados por
-- teams.report_recipients (informe de equipo) y
-- organizations.executive_summary_recipients (resumen ejecutivo).
alter table organizations drop column if exists delivery_channel;
alter table organizations drop column if exists delivery_target;
