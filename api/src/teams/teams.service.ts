import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly supabase: SupabaseService) {}

  // El backend siempre consulta con la service_role key (bypasea RLS), así
  // que la autorización "solo tus propios equipos" se hace acá, no en la
  // base de datos — ver docs/especificaciones-tecnicas.md, sección 0.1.
  private async assertOwnership(teamId: string, organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('id, organization_id')
      .eq('id', teamId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Equipo no encontrado');
    if (data.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }
  }

  // Roadmap paso 14: límites de plan. max_teams/max_members_per_team en
  // NULL significa sin límite (solo Plan Custom) — ver
  // docs/mvp-resumen-semanal-equipos.md, sección 11.
  private async assertTeamLimit(organizationId: string) {
    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('max_teams')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;
    if (org.max_teams === null) return;

    const { count, error: countError } = await this.supabase.db
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    if (countError) throw countError;

    if ((count ?? 0) >= org.max_teams) {
      throw new ForbiddenException(
        `Tu plan permite hasta ${org.max_teams} equipo(s) — actualiza de plan para crear más.`,
      );
    }
  }

  private async assertMemberLimit(teamId: string, organizationId: string) {
    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('max_members_per_team')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;
    if (org.max_members_per_team === null) return;

    const { count, error: countError } = await this.supabase.db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('active', true);
    if (countError) throw countError;

    if ((count ?? 0) >= org.max_members_per_team) {
      throw new ForbiddenException(
        `Tu plan permite hasta ${org.max_members_per_team} miembro(s) por equipo — actualiza de plan para añadir más.`,
      );
    }
  }

  async createTeam(organizationId: string, dto: CreateTeamDto) {
    await this.assertTeamLimit(organizationId);
    const { data, error } = await this.supabase.db
      .from('teams')
      .insert({ ...dto, organization_id: organizationId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listOwn(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return data;
  }

  async getOwn(organizationId: string, teamId: string) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Equipo no encontrado');
    if (data.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }
    return data;
  }

  async updateTeam(organizationId: string, teamId: string, dto: UpdateTeamDto) {
    await this.assertOwnership(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('teams')
      .update(dto)
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async addMember(organizationId: string, teamId: string, dto: CreateMemberDto) {
    await this.assertOwnership(teamId, organizationId);
    await this.assertMemberLimit(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .insert({ ...dto, team_id: teamId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // El miembro tiene que ser de ESE equipo Y ese equipo de la organización
  // del que llama — dos saltos, no uno, para no poder editar/borrar un
  // miembro pasándole el team_id de un equipo propio pero el member_id de
  // uno ajeno.
  private async assertMemberOwnership(teamId: string, memberId: string, organizationId: string) {
    await this.assertOwnership(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .select('id, team_id')
      .eq('id', memberId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.team_id !== teamId) {
      throw new NotFoundException('Miembro no encontrado');
    }
  }

  async updateMember(organizationId: string, teamId: string, memberId: string, dto: UpdateMemberDto) {
    await this.assertMemberOwnership(teamId, memberId, organizationId);
    // Reactivar a alguien desactivado cuenta contra el límite del plan
    // igual que dar de alta uno nuevo — sin este chequeo, borrar y
    // reactivar sería una forma de saltarse max_members_per_team.
    if (dto.active === true) {
      await this.assertMemberLimit(teamId, organizationId);
    }
    // Mover de equipo: el equipo de destino tiene que ser de la misma
    // organización (assertOwnership ya lo comprueba) y respetar su propio
    // max_members_per_team — sin este chequeo, mover sería una forma de
    // saltarse el límite del plan en el equipo de destino.
    if (dto.team_id && dto.team_id !== teamId) {
      await this.assertOwnership(dto.team_id, organizationId);
      await this.assertMemberLimit(dto.team_id, organizationId);
    }
    const { data, error } = await this.supabase.db
      .from('members')
      .update(dto)
      .eq('id', memberId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Soft delete (active=false) — no un DELETE de la fila. El historial de
  // checkins/informes ya generados sigue referenciando a este miembro por
  // nombre; borrarlo de verdad no aporta nada y solo complica los reportes
  // pasados. `listMembers`/`statusForTeamWeek` ya filtran por active=true.
  async removeMember(organizationId: string, teamId: string, memberId: string) {
    await this.assertMemberOwnership(teamId, memberId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .update({ active: false })
      .eq('id', memberId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listMembersForOwner(organizationId: string, teamId: string) {
    await this.assertOwnership(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true);
    if (error) throw error;
    return data;
  }

  // Sin scoping por organización — solo lo usan los jobs internos (cron),
  // nunca un endpoint expuesto al front. Trae el horario de la
  // organización (migración 0006: config de cuenta, no por equipo) y la
  // config del resumen ejecutivo (migración 0009) y lo aplana sobre el
  // equipo, así ReminderJob/ReportJob no tienen que saber de dónde sale
  // cada campo. `report_recipients` ya viene del `*` de teams.
  async listAll() {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select(
        '*, organizations(reminder_dow, reminder_time, cutoff_time, timezone, language, has_executive_summary, executive_summary_recipients)',
      );
    if (error) throw error;
    return (data ?? []).map((t: any) => {
      const { organizations: org, ...team } = t;
      return {
        ...team,
        reminder_dow: org.reminder_dow,
        reminder_time: org.reminder_time,
        cutoff_time: org.cutoff_time,
        timezone: org.timezone,
        language: org.language,
        has_executive_summary: org.has_executive_summary,
        executive_summary_recipients: org.executive_summary_recipients,
      };
    });
  }

  async listMembers(teamId: string) {
    const { data, error } = await this.supabase.db
      .from('members')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true);
    if (error) throw error;
    return data;
  }
}
