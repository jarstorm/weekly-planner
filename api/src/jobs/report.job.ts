import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TeamsService } from '../teams/teams.service';
import { CheckinsService } from '../checkins/checkins.service';
import { ChannelsService } from '../channels/channels.service';
import { AggregateService } from '../aggregate/aggregate.service';
import { SupabaseService } from '../supabase/supabase.service';
import { currentWeekStart, dowInTimezone, isWithinWindow } from './date.utils';

// Simétrico a ReminderJob pero disparado por teams.cutoff_time: genera el
// informe con IA a partir de los checkins de la semana y lo entrega al
// canal/destino del equipo (teams.delivery_channel / delivery_target).
@Injectable()
export class ReportJob {
  private readonly logger = new Logger(ReportJob.name);

  constructor(
    private readonly teams: TeamsService,
    private readonly checkins: CheckinsService,
    private readonly channels: ChannelsService,
    private readonly aggregate: AggregateService,
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

  private async generateAndDeliver(team: any, weekStart: string) {
    const members = await this.teams.listMembers(team.id);
    const rows = await this.checkins.listForTeamWeek(team.id, weekStart);

    const respondedMemberIds = new Set(rows.map((r: any) => r.member_id));
    const membersWithoutResponse = members
      .filter((m: any) => !respondedMemberIds.has(m.id))
      .map((m: any) => m.name);

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
      pastBlockers: [], // TODO: detección de bloqueos recurrentes (fuera del alcance de este paso)
    });

    const { error: insertError } = await this.supabase.db.from('reports').insert({
      team_id: team.id,
      week_start: weekStart,
      content_markdown: content,
      generated_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    if (team.delivery_target) {
      await this.channels.get(team.delivery_channel).send(team.delivery_target, content);
      await this.supabase.db
        .from('reports')
        .update({ delivered_at: new Date().toISOString() })
        .eq('team_id', team.id)
        .eq('week_start', weekStart);
    }
  }
}
