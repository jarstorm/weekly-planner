-- Un número de WhatsApp/Telegram solo debería poder estar activo en un
-- miembro a la vez en toda la aplicación — el matching del webhook
-- entrante (WebhooksController.matchMemberAndSaveCheckin) busca por
-- (contact, channel, active=true) y rompe con "multiple rows" si hay dos
-- miembros activos con el mismo contacto (encontrado en producción:
-- quitar y volver a dar de alta a alguien con el mismo número, antes de
-- filtrar por active en el código, ya dejaba dos filas activas a la vez
-- en una condición de carrera). Índice parcial, no sobre toda la tabla:
-- - solo mientras active=true — un miembro dado de baja (soft delete) no
--   bloquea que otro miembro use su mismo número después.
-- - no aplica a channel='email' — ahí SÍ es intencional poder repetir el
--   mismo contacto en varios miembros (ver docs/pruebas-produccion.md,
--   "Cuenta de pruebas" — el matching de email es por token firmado por
--   miembro, no por dirección, EmailChannel.parseIncoming ni está
--   implementado).
create unique index if not exists members_active_contact_per_channel
  on members (channel, contact)
  where active and channel <> 'email';
