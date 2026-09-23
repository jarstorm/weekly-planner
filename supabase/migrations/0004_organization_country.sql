-- Ficha de la empresa (sección "Ajustes" del panel): país, para saber
-- dónde está radicada la cuenta (referencia para IVA/impuestos junto a
-- Stripe Tax, que ya calcula el impuesto real en el checkout — ver
-- docs/especificaciones-tecnicas.md). Código ISO 3166-1 alpha-2 ('ES',
-- 'US', ...), no el nombre completo del país.
alter table organizations add column if not exists country text;
