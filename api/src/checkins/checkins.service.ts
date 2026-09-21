import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Injectable()
export class CheckinsService {
  constructor(private readonly supabase: SupabaseService) {}

  // Endpoint manual (POST /api/checkins/manual, roadmap paso 5) — expuesto
  // al dueño del equipo autenticado, así que valida que el team_id sea suyo
  // antes de escribir.
  async saveManual(organizationId: string, dto: CreateCheckinDto) {
    const { data: team, error: teamError } = await this.supabase.db
      .from('teams')
      .select('id, organization_id')
      .eq('id', dto.team_id)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) throw new NotFoundException('Equipo no encontrado');
    if (team.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }
    return this.saveInternal(dto);
  }

  // Sin chequeo de organización — usado por el webhook de WhatsApp, donde
  // team_id/member_id ya vienen resueltos server-side a partir del número
  // de teléfono que escribió (no hay input de usuario que falsificar).
  async saveInternal(dto: CreateCheckinDto) {
    const { data, error } = await this.supabase.db
      .from('checkins')
      .upsert(dto, { onConflict: 'member_id,week_start' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listForTeamWeek(teamId: string, weekStart: string) {
    const { data, error } = await this.supabase.db
      .from('checkins')
      .select('*, members(name)')
      .eq('team_id', teamId)
      .eq('week_start', weekStart);
    if (error) throw error;
    return data;
  }
}
