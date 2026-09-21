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

  async createTeam(organizationId: string, dto: CreateTeamDto) {
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
