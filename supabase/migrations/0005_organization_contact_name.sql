-- Ficha de la empresa: nombre de la persona de contacto (quien recibe
-- avisos/soporte), distinto del email de registro (ese sale de auth.users,
-- no se guarda aparte — ver OrganizationsController.getOwn).
alter table organizations add column if not exists contact_name text;
