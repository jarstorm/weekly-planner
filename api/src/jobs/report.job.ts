import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TeamsService } from '../teams/teams.service';
import { CheckinsService } from '../checkins/checkins.service';
import { ChannelsService } from '../channels/channels.service';
import { AggregateService } from '../aggregate/aggregate.service';
import { PdfService } from '../pdf/pdf.service';
import { SupabaseService } from '../supabase/supabase.service';
import { currentWeekStart, dowInTimezone, isWithinWindow } from './date.utils';
import { extractBlockersSection, isMeaningfulBlocker } from './blockers.utils';

const PAST_REPORTS_FOR_RECURRENCE = 3;

// Simétrico a ReminderJob pero disparado por la hora de corte de la cuenta:
// genera el informe con IA a partir de los checkins de la semana y lo
// entrega al canal/destino de la cuenta (organizations.delivery_channel /
// delivery_target, migración 0006 — mismo destino para todos los equipos).
@Injectable()
export class ReportJob {
  private readonly logger = new Logger(ReportJob.name);

  constructor(
    private readonly teams: TeamsService,
    private readonly checkins: CheckinsService,
    private readonly channels: ChannelsService,
    private readonly aggregate: AggregateService,
    private readonly pdf: PdfService,
    private readonly supabase: SupabaseService,
  ) {}

  @Cron('*/15 * * * *')
  async run() {
    const now = new Date();
    const allTeams = await this.teams.listAll();

    for (const team of allTeams) {
      if (dowInTimezone(now, team.timezone) !== team.reminder_dow) continue;
      if (!isWithinWindow(now, team.timezone, team.cutoff_time)) continue;

      const weekStart = currentWeekStart(now, team.timezone);

      const alreadyGenerated = await this.reportExists(team.id, weekStart);
      if (alreadyGenerated) continue;

      try {
        await this.generateAndDeliver(team, weekStart);
      } catch (err) {
        this.logger.error(`Fallo generando informe para equipo ${team.id}`, err as Error);
      }
    }
  }

  private async reportExists(teamId: string, weekStart: string): Promise<boolean> {
    const { data, error } = await this.supabase.db
      .from('reports')
      .select('id')
      .eq('team_id', teamId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  private async fetchPastBlockers(teamId: string, beforeWeekStart: string): Promise<string[]> {
    const { data, error } = await this.supabase.db
      .from('reports')
      .select('week_start, content_markdown')
      .eq('team_id', teamId)
      .lt('week_start', beforeWeekStart)
      .order('week_start', { ascending: false })
      .limit(PAST_REPORTS_FOR_RECURRENCE);
    if (error) throw error;

    const blockers: string[] = [];
    for (const report of data ?? []) {
      const section = extractBlockersSection(report.content_markdown ?? '');
      if (section && isMeaningfulBlocker(section)) {
        blockers.push(`Semana del ${report.week_start}: ${section}`);
      }
    }
    return blockers;
  }

  private async generateAndDeliver(team: any, weekStart: string) {
    const members = await this.teams.listMembers(team.id);
    const rows = await this.checkins.listForTeamWeek(team.id, weekStart);

    const respondedMemberIds = new Set(rows.map((r: any) => r.member_id));
    const membersWithoutResponse = members
      .filter((m: any) => !respondedMemberIds.has(m.id))
      .map((m: any) => m.name);

    // Últimos 3 informes del equipo, para que la IA pueda señalar si un
    // bloqueo ya viene repitiéndose (pedido explícitamente — antes era un
    // TODO sin implementar).
    const pastBlockers = await this.fetchPastBlockers(team.id, weekStart);

    const content = await this.aggregate.generateReport({
      teamName: team.name,
      companyContext: team.company_context ?? '',
      checkins: rows.map((r: any) => ({
        memberName: r.members?.name ?? 'desconocido',
        doneText: r.done_text ?? r.raw_text,
        nextText: r.next_text,
        blockerText: r.blocker_text,
      })),
      membersWithoutResponse,
      pastBlockers,
    });

    const { error: insertError } = await this.supabase.db.from('reports').insert({
      team_id: team.id,
      week_start: weekStart,
      content_markdown: content,
      generated_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    if (team.delivery_target) {
      // El informe siempre se entrega como PDF adjunto — en los tres
      // canales, no solo por email (decisión explícita, ver
      // docs/especificaciones-tecnicas.md sección 0.2/3.1).
      const title = `Resumen semanal — ${team.name} — semana del ${weekStart}`;
      const pdfBuffer = await this.pdf.fromMarkdown(content, title);
      const filename = `resumen-semanal-${weekStart}.pdf`;
      const caption = `Resumen semanal de ${team.name} — semana del ${weekStart}. Adjunto en PDF.`;

      await this.channels
        .get(team.delivery_channel)
        .sendDocument(team.delivery_target, pdfBuffer, filename, caption);
      await this.supabase.db
        .from('reports')
        .update({ delivered_at: new Date().toISOString() })
        .eq('team_id', team.id)
        .eq('week_start', weekStart);
    }
  }
}
