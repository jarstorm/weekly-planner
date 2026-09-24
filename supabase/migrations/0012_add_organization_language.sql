-- Idioma de la cuenta: se usa para las preguntas que recibe el empleado
-- (recordatorio semanal, encuesta mensual), el link público que se le manda
-- (/checkin, /survey en ese idioma) y el prompt de la IA (informe semanal y
-- resumen ejecutivo) — de cuenta, no por equipo ni por persona, pedido
-- explícito. La interfaz del panel del admin NO se controla por esto: sigue
-- con su propio selector ES/EN independiente (next-intl, por navegador).
alter table organizations
  add column if not exists language text not null default 'es'
    check (language in ('es', 'en'));
