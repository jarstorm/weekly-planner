import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

export interface MemberCheckinStatus {
  memberId: string;
  memberName: string;
  channel: string;
  responded: boolean;
  doneText: string | null;
  nextText: string | null;
  blockerText: string | null;
  rawText: string | null;
  receivedAt: string | null;
}

@Injectable()
export class CheckinsService {
  constructor(private readonly supabase: SupabaseService) {}

  private async assertTeamOwnership(teamId: string, organizationId: string) {
    const { data: team, error } = await this.supabase.db
      .from('teams')
      .select('id, organization_id, name')
      .eq('id', teamId)
      .maybeSingle();
    if (error) throw error;
    if (!team) throw new NotFoundException('Equipo no encontrado');
    if (team.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }
    return team;
  }

  // Endpoint manual (POST /api/checkins/manual, roadmap paso 5) — expuesto
  // al dueño del equipo autenticado, así que valida que el team_id sea suyo
  // antes de escribir.
  async saveManual(organizationId: string, dto: CreateCheckinDto) {
    await this.assertTeamOwnership(dto.team_id, organizationId);
    return this.saveInternal(dto);
  }

  // Sin chequeo de organización — usado por el webhook de Telegram, donde
  // team_id/member_id ya vienen resueltos server-side a partir del contacto
  // que escribió (no hay input de usuario que falsificar).
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

  // Estado por miembro (respondió/no respondió) para una semana — el jefe
  // quiere ver esto tanto de la semana en curso (antes de que exista
  // informe) como de semanas pasadas, ya generado el informe. Se calcula
  // sobre members + checkins, no sobre el texto que devolvió la IA — más
  // fiable que confiar en que el modelo lo mencione siempre igual.
  async statusForTeamWeek(organizationId: string, teamId: string, weekStart: string): Promise<MemberCheckinStatus[]> {
    await this.assertTeamOwnership(teamId, organizationId);

    const { data: members, error: membersError } = await this.supabase.db
      .from('members')
      .select('id, name, channel')
      .eq('team_id', teamId)
      .eq('active', true);
    if (membersError) throw membersError;

    const { data: checkins, error: checkinsError } = await this.supabase.db
      .from('checkins')
      .select('*')
      .eq('team_id', teamId)
      .eq('week_start', weekStart);
    if (checkinsError) throw checkinsError;

    const byMember = new Map((checkins ?? []).map((c: any) => [c.member_id, c]));

    return (members ?? []).map((m: any) => {
      const c = byMember.get(m.id);
      return {
        memberId: m.id,
        memberName: m.name,
        channel: m.channel,
        responded: !!c,
        doneText: c?.done_text ?? null,
        nextText: c?.next_text ?? null,
        blockerText: c?.blocker_text ?? null,
        rawText: c?.raw_text ?? null,
        receivedAt: c?.received_at ?? null,
      };
    });
  }

  // Descarga de todas las conversaciones completas de un equipo — todas
  // las semanas si no se pasa weekStart, una sola si se pasa. Texto plano,
  // pensado para bajarse y leer o archivar, no para volver a subirlo.
  async exportConversations(organizationId: string, teamId: string, weekStart?: string): Promise<string> {
    const team = await this.assertTeamOwnership(teamId, organizationId);

    let query = this.supabase.db
      .from('checkins')
      .select('*, members(name)')
      .eq('team_id', teamId)
      .order('week_start', { ascending: false });
    if (weekStart) query = query.eq('week_start', weekStart);

    const { data, error } = await query;
    if (error) throw error;

    const lines: string[] = [`Conversaciones — ${team.name}`, ''];
    let currentWeek: string | null = null;
    for (const c of data ?? []) {
      if (c.week_start !== currentWeek) {
        currentWeek = c.week_start;
        lines.push(`=== Semana del ${currentWeek} ===`, '');
      }
      const memberName = (c as any).members?.name ?? 'desconocido';
      lines.push(`--- ${memberName} (recibido ${c.received_at}) ---`);
      if (c.raw_text) {
        lines.push(c.raw_text);
      } else {
        if (c.done_text) lines.push(`Qué hizo: ${c.done_text}`);
        if (c.next_text) lines.push(`Qué hará: ${c.next_text}`);
        if (c.blocker_text) lines.push(`Bloqueo: ${c.blocker_text}`);
      }
      lines.push('');
    }
    if ((data ?? []).length === 0) {
      lines.push('(sin respuestas registradas)');
    }
    return lines.join('\n');
  }
}
