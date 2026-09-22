-- WhatsApp queda fuera del MVP (decisión explícita, ver
-- docs/especificaciones-tecnicas.md sección 0.2) — se saca del código de la
-- app pero el diseño queda documentado para retomarlo cuando haga falta.
-- Ningún equipo/miembro real usaba 'whatsapp' todavía (nunca hubo
-- credenciales de Meta configuradas), así que no hace falta migrar datos.
alter table organizations drop constraint if exists organizations_delivery_channel_check;
alter table organizations add constraint organizations_delivery_channel_check
  check (delivery_channel in ('email', 'telegram'));

alter table teams drop constraint if exists teams_delivery_channel_check;
alter table teams add constraint teams_delivery_channel_check
  check (delivery_channel in ('email', 'telegram'));

alter table members drop constraint if exists members_channel_check;
alter table members add constraint members_channel_check
  check (channel in ('email', 'telegram'));
