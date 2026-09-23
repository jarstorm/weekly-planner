-- Se retoma WhatsApp (ver docs/especificaciones-tecnicas.md sección 0.2):
-- cuenta de WhatsApp Business operativa en unos días. Reinstala 'whatsapp'
-- en los mismos checks que la migración 0003 había sacado.
alter table organizations drop constraint if exists organizations_delivery_channel_check;
alter table organizations add constraint organizations_delivery_channel_check
  check (delivery_channel in ('email', 'whatsapp', 'telegram'));

alter table members drop constraint if exists members_channel_check;
alter table members add constraint members_channel_check
  check (channel in ('email', 'whatsapp', 'telegram'));
