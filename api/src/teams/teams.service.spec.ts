import { ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TeamsService } from './teams.service';

// Cadena de queries de supabase-js (from().select().eq().single()/maybeSingle(),
// o directamente awaited para el patrón de count) simulada con una cola de
// respuestas: cada llamada a `.from()` consume la siguiente, en el orden
// exacto en que TeamsService las dispara. Frágil a cambios de orden en el
// servicio, pero evita levantar un Supabase real para probar la lógica de
// límites de plan (paso 14 del roadmap).
function fakeSupabase(responses: Array<{ data?: any; error?: any; count?: number }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(result)),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

describe('TeamsService — límites de plan', () => {
  const orgId = 'org-1';

  it('crea el equipo cuando está por debajo de max_teams', async () => {
    const supabase = fakeSupabase([
      { data: { max_teams: 5 }, error: null }, // organizations.select(max_teams)
      { count: 2, error: null }, // teams count
      { data: { id: 'team-1', name: 'Marketing' }, error: null }, // insert
    ]);
    const service = new TeamsService(supabase);

    const team = await service.createTeam(orgId, { name: 'Marketing' } as any);
    expect(team).toEqual({ id: 'team-1', name: 'Marketing' });
  });

  it('rechaza crear equipo cuando alcanzó max_teams', async () => {
    const supabase = fakeSupabase([
      { data: { max_teams: 1 }, error: null },
      { count: 1, error: null },
    ]);
    const service = new TeamsService(supabase);

    await expect(service.createTeam(orgId, { name: 'Marketing' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('sin límite (max_teams null, Plan Custom) siempre puede crear', async () => {
    const supabase = fakeSupabase([
      { data: { max_teams: null }, error: null },
      { data: { id: 'team-1', name: 'Marketing' }, error: null }, // insert directo, sin count
    ]);
    const service = new TeamsService(supabase);

    const team = await service.createTeam(orgId, { name: 'Marketing' } as any);
    expect(team).toEqual({ id: 'team-1', name: 'Marketing' });
  });

  it('rechaza añadir miembro cuando alcanzó max_members_per_team', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { max_members_per_team: 2 }, error: null }, // organizations.select
      { count: 2, error: null }, // members count
    ]);
    const service = new TeamsService(supabase);

    await expect(
      service.addMember(orgId, 'team-1', { name: 'Ana', channel: 'email', contact: 'ana@x.com' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza añadir miembro a un equipo de otra organización', async () => {
    const supabase = fakeSupabase([{ data: { id: 'team-1', organization_id: 'otra-org' }, error: null }]);
    const service = new TeamsService(supabase);

    await expect(
      service.addMember(orgId, 'team-1', { name: 'Ana', channel: 'email', contact: 'ana@x.com' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('actualiza un miembro sin tocar el límite si no reactiva (active no viene en true)', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'member-1', name: 'Ana Nueva' }, error: null }, // update
    ]);
    const service = new TeamsService(supabase);

    const member = await service.updateMember(orgId, 'team-1', 'member-1', { name: 'Ana Nueva' } as any);
    expect(member).toEqual({ id: 'member-1', name: 'Ana Nueva' });
  });

  it('rechaza reactivar un miembro (active: true) si ya se alcanzó max_members_per_team', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { max_members_per_team: 2 }, error: null }, // organizations.select
      { count: 2, error: null }, // members count
    ]);
    const service = new TeamsService(supabase);

    await expect(
      service.updateMember(orgId, 'team-1', 'member-1', { active: true } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('removeMember hace soft delete (active: false), no borra la fila', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'member-1', active: false }, error: null }, // update
    ]);
    const service = new TeamsService(supabase);

    const member = await service.removeMember(orgId, 'team-1', 'member-1');
    expect(member).toEqual({ id: 'member-1', active: false });
  });

  it('rechaza editar/borrar un miembro que no pertenece a ese equipo', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership (team-1 sí es mío)
      { data: { id: 'member-1', team_id: 'otro-team' }, error: null }, // pero el miembro es de otro equipo
    ]);
    const service = new TeamsService(supabase);

    await expect(service.removeMember(orgId, 'team-1', 'member-1')).rejects.toThrow('Miembro no encontrado');
  });
});
