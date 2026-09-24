-- Plan Equipo: baja el límite de miembros por equipo de 20 a 10 (decisión
-- de producto). Solo afecta a organizaciones en ese plan que todavía
-- tuvieran el valor por defecto anterior — no toca Organización/Custom.
-- No expulsa a nadie: TeamsService.assertMemberLimit solo se dispara al
-- dar de alta o reactivar un miembro, nunca sobre los ya activos.
update organizations
set max_members_per_team = 10
where plan = 'equipo' and max_members_per_team = 20;
