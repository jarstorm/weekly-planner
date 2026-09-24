-- Antes, cada mensaje entrante (Telegram/WhatsApp) pisaba el anterior en la
-- misma semana (upsert simple sobre member_id+week_start). Pedido
-- explícito: concatenar todos los mensajes de texto que lleguen hasta la
-- hora de corte, y guardar cada nota de voz aparte (no solo la última) —
-- ver CheckinsService.appendIncoming y webhooks.controller.ts.
--
-- El formulario web (checkin-form) y el endpoint manual de pruebas
-- (POST /checkins/manual) NO cambian de comportamiento: siguen siendo un
-- envío único de done_text/next_text/blocker_text, sin concatenar.
alter table checkins add column if not exists audio_paths text[] not null default '{}';
update checkins set audio_paths = array[audio_path] where audio_path is not null;
alter table checkins drop column if exists audio_path;
