-- Confirmación de que el email de un miembro es real y alcanzable — mismo
-- criterio que la verificación de cuenta del dueño (migración de
-- AuthService.register/verifyEmail), pero aquí no bloquea nada (los
-- miembros no tienen login): solo es un indicador en el panel y una forma
-- de saber si hace falta reenviar el email.
alter table members add column if not exists email_verified_at timestamptz;
