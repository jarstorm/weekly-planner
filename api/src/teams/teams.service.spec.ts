import { ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MemberVerifyService } from '../member-verify/member-verify.service';
import { WhatsappChannel } from '../channels/whatsapp.channel';
import { TeamsService } from './teams.service';

function fakeMemberVerify(): MemberVerifyService {
  return { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) } as unknown as MemberVerifyService;
}

function fakeWhatsapp(): WhatsappChannel {
  return { sendTemplate: jest.fn().mockResolvedValue(undefined) } as unknown as WhatsappChannel;
}

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
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    const team = await service.createTeam(orgId, { name: 'Marketing' } as any);
    expect(team).toEqual({ id: 'team-1', name: 'Marketing' });
  });

  it('rechaza crear equipo cuando alcanzó max_teams', async () => {
    const supabase = fakeSupabase([
      { data: { max_teams: 1 }, error: null },
      { count: 1, error: null },
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    await expect(service.createTeam(orgId, { name: 'Marketing' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('sin límite (max_teams null, Plan Custom) siempre puede crear', async () => {
    const supabase = fakeSupabase([
      { data: { max_teams: null }, error: null },
      { data: { id: 'team-1', name: 'Marketing' }, error: null }, // insert directo, sin count
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    const team = await service.createTeam(orgId, { name: 'Marketing' } as any);
    expect(team).toEqual({ id: 'team-1', name: 'Marketing' });
  });

  it('rechaza añadir miembro cuando alcanzó max_members_per_team', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { max_members_per_team: 2 }, error: null }, // organizations.select
      { count: 2, error: null }, // members count
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    await expect(
      service.addMember(orgId, 'team-1', { name: 'Ana', channel: 'email', contact: 'ana@x.com' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza añadir miembro a un equipo de otra organización', async () => {
    const supabase = fakeSupabase([{ data: { id: 'team-1', organization_id: 'otra-org' }, error: null }]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

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
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

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
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    await expect(
      service.updateMember(orgId, 'team-1', 'member-1', { active: true } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('mueve un miembro a otro equipo de la misma organización', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership (team-1)
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'team-2', organization_id: orgId }, error: null }, // assertOwnership (team-2, destino)
      { data: { max_members_per_team: 5 }, error: null }, // organizations.select (límite destino)
      { count: 1, error: null }, // members count del equipo destino
      { data: { id: 'member-1', team_id: 'team-2' }, error: null }, // update
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    const member = await service.updateMember(orgId, 'team-1', 'member-1', { team_id: 'team-2' } as any);
    expect(member).toEqual({ id: 'member-1', team_id: 'team-2' });
  });

  it('rechaza mover a un equipo que ya alcanzó max_members_per_team', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership (team-1)
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'team-2', organization_id: orgId }, error: null }, // assertOwnership (team-2, destino)
      { data: { max_members_per_team: 1 }, error: null }, // organizations.select
      { count: 1, error: null }, // members count del equipo destino, ya lleno
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    await expect(
      service.updateMember(orgId, 'team-1', 'member-1', { team_id: 'team-2' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza mover a un equipo de otra organización', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership (team-1)
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'team-2', organization_id: 'otra-org' }, error: null }, // assertOwnership (team-2, destino ajeno)
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    await expect(
      service.updateMember(orgId, 'team-1', 'member-1', { team_id: 'team-2' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('removeMember hace soft delete (active: false), no borra la fila', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'member-1', active: false }, error: null }, // update
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    const member = await service.removeMember(orgId, 'team-1', 'member-1');
    expect(member).toEqual({ id: 'member-1', active: false });
  });

  it('rechaza editar/borrar un miembro que no pertenece a ese equipo', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership (team-1 sí es mío)
      { data: { id: 'member-1', team_id: 'otro-team' }, error: null }, // pero el miembro es de otro equipo
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    await expect(service.removeMember(orgId, 'team-1', 'member-1')).rejects.toThrow('Miembro no encontrado');
  });
});

describe('TeamsService — verificación de email de miembros', () => {
  const orgId = 'org-1';

  it('al dar de alta un miembro por email, manda el email de verificación', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { max_members_per_team: null }, error: null }, // organizations.select — sin límite
      { data: { id: 'member-1', name: 'Ana', contact: 'ana@x.com', channel: 'email' }, error: null }, // insert
    ]);
    const memberVerify = fakeMemberVerify();
    const service = new TeamsService(supabase, memberVerify, fakeWhatsapp());

    await service.addMember(orgId, 'team-1', { name: 'Ana', channel: 'email', contact: 'ana@x.com' } as any);

    expect(memberVerify.sendVerificationEmail).toHaveBeenCalledWith('member-1', 'Ana', 'ana@x.com', 'team-1');
  });

  it('al dar de alta un miembro por telegram, NO manda email de verificación', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null },
      { data: { max_members_per_team: null }, error: null },
      { data: { id: 'member-1', name: 'Ana', contact: null, channel: 'telegram' }, error: null },
    ]);
    const memberVerify = fakeMemberVerify();
    const service = new TeamsService(supabase, memberVerify, fakeWhatsapp());

    await service.addMember(orgId, 'team-1', { name: 'Ana', channel: 'telegram' } as any);

    expect(memberVerify.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('resendMemberVerification reenvía el email a un miembro con canal email', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null }, // assertOwnership
      { data: { id: 'member-1', team_id: 'team-1' }, error: null }, // assertMemberOwnership
      { data: { id: 'member-1', name: 'Ana', contact: 'ana@x.com', channel: 'email' }, error: null }, // select
    ]);
    const memberVerify = fakeMemberVerify();
    const service = new TeamsService(supabase, memberVerify, fakeWhatsapp());

    const result = await service.resendMemberVerification(orgId, 'team-1', 'member-1');

    expect(memberVerify.sendVerificationEmail).toHaveBeenCalledWith('member-1', 'Ana', 'ana@x.com', 'team-1');
    expect(result).toEqual({ ok: true });
  });

  it('resendMemberVerification rechaza a un miembro que no es de canal email', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: orgId }, error: null },
      { data: { id: 'member-1', team_id: 'team-1' }, error: null },
      { data: { id: 'member-1', name: 'Ana', contact: null, channel: 'telegram' }, error: null },
    ]);
    const memberVerify = fakeMemberVerify();
    const service = new TeamsService(supabase, memberVerify, fakeWhatsapp());

    await expect(service.resendMemberVerification(orgId, 'team-1', 'member-1')).rejects.toThrow(ForbiddenException);
    expect(memberVerify.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('TeamsService#listAll', () => {
  it('excluye equipos de organizaciones con status=canceled (baja o impago)', async () => {
    const supabase = fakeSupabase([
      {
        data: [
          { id: 'team-1', organization_id: 'org-1', organizations: { status: 'active' } },
          { id: 'team-2', organization_id: 'org-2', organizations: { status: 'canceled' } },
          { id: 'team-3', organization_id: 'org-3', organizations: { status: 'trial' } },
        ],
        error: null,
      },
    ]);
    const service = new TeamsService(supabase, fakeMemberVerify(), fakeWhatsapp());

    const teams = await service.listAll();

    expect(teams.map((t: any) => t.id)).toEqual(['team-1', 'team-3']);
  });
});
