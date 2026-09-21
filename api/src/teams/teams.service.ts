import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateMemberDto } from './dto/create-member.dto';

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

  // Sin scoping por organización — solo lo usan los jobs internos (cron),
  // nunca un endpoint expuesto al front.
  async listAll() {
    const { data, error } = await this.supabase.db.from('teams').select('*');
    if (error) throw error;
    return data;
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
