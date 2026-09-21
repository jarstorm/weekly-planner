import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ReportsService {
  constructor(private readonly supabase: SupabaseService) {}

  // Roadmap paso 11: histórico de informes. Solo equipos de la propia
  // organización — mismo criterio de autorización que TeamsService (ver
  // docs/especificaciones-tecnicas.md, sección 0.1).
  async listForTeam(organizationId: string, teamId: string) {
    const { data: team, error: teamError } = await this.supabase.db
      .from('teams')
      .select('id, organization_id')
      .eq('id', teamId)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) throw new NotFoundException('Equipo no encontrado');
    if (team.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }

    const { data, error } = await this.supabase.db
      .from('reports')
      .select('id, week_start, content_markdown, generated_at, delivered_at')
      .eq('team_id', teamId)
      .order('week_start', { ascending: false });
    if (error) throw error;
    return data;
  }
}
