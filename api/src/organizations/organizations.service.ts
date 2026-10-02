import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

const SELECT_FIELDS =
  'id, name, country, contact_name, reminder_dow, reminder_time, cutoff_time, timezone, language, plan, max_teams, max_members_per_team, has_executive_summary, executive_summary_recipients';

@Injectable()
export class OrganizationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getOwn(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .select(SELECT_FIELDS)
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Organización no encontrada');
    return data;
  }

  async updateOwn(organizationId: string, dto: UpdateOrganizationDto) {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .update(dto)
      .eq('id', organizationId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return data;
  }

  // Todas las personas activas de todos los equipos de la cuenta, con el
  // nombre de su equipo ya resuelto — sin esto, verlas todas juntas
  // requería entrar equipo por equipo. Mismo patrón en dos pasos que
  // SurveyService.countActiveMembers (subconsulta de team_id no es directa
  // en supabase-js).
  async listMembers(organizationId: string) {
    const { data: teams, error: teamsError } = await this.supabase.db
      .from('teams')
      .select('id, name')
      .eq('organization_id', organizationId);
    if (teamsError) throw teamsError;
    const teamIds = (teams ?? []).map((t: any) => t.id);
    if (teamIds.length === 0) return [];

    const teamNameById = new Map((teams ?? []).map((t: any) => [t.id, t.name]));

    const { data: members, error } = await this.supabase.db
      .from('members')
      .select('id, name, channel, contact, team_id, email_verified_at')
      .in('team_id', teamIds)
      .eq('active', true)
      .order('name');
    if (error) throw error;

    return (members ?? []).map((m: any) => ({
      ...m,
      team_name: teamNameById.get(m.team_id) ?? '',
    }));
  }
}
