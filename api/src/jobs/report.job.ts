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
import { executiveSummaryDeliveryText, reportDeliveryText } from '../account-language';

const PAST_REPORTS_FOR_RECURRENCE = 3;

// Simétrico a ReminderJob pero disparado por la hora de corte de la cuenta
// (organizations.reminder_dow/cutoff_time, migración 0006 — mismo horario
// para todos los equipos): genera el informe con IA a partir de los
// checkins de la semana y lo entrega a teams.report_recipients (lista de
// emails por equipo, migración 0009). Al terminar la ronda de equipos,
// intenta generar el resumen ejecutivo de cada organización que lo tenga
// activado (sección 6.4 del doc de producto) — solo cuando TODOS sus
// equipos ya tienen informe generado esta semana.
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

    // organización → weekStart de esta ronda, para saber a qué organizaciones
    // hay que intentarles el resumen ejecutivo después del loop de equipos.
    const touchedOrgs = new Map<string, string>();

    for (const team of allTeams) {
      if (dowInTimezone(now, team.timezone) !== team.reminder_dow) continue;
      if (!isWithinWindow(now, team.timezone, team.cutoff_time)) continue;

      const weekStart = currentWeekStart(now, team.timezone);
      touchedOrgs.set(team.organization_id, weekStart);

      const alreadyGenerated = await this.reportExists(team.id, weekStart);
      if (alreadyGenerated) continue;

      try {
        await this.generateAndDeliver(team, weekStart);
      } catch (err) {
        this.logger.error(`Fallo generando informe para equipo ${team.id}`, err as Error);
      }
    }

    for (const [organizationId, weekStart] of touchedOrgs) {
      try {
        await this.maybeGenerateExecutiveSummary(organizationId, weekStart);
      } catch (err) {
        this.logger.error(`Fallo generando resumen ejecutivo para organización ${organizationId}`, err as Error);
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

  private async orgReportExists(organizationId: string, weekStart: string): Promise<boolean> {
    const { data, error } = await this.supabase.db
      .from('reports')
      .select('id')
      .eq('organization_id', organizationId)
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
      language: team.language,
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
    if (insertError) {
      // 23505 = unique_violation en reports_team_week_unique — visto en
      // producción: dos ejecuciones de run() solapadas generan el mismo
      // informe a la vez, la primera en insertar gana. No es un fallo real
      // (el informe ya existe, generado por la otra ejecución), así que no
      // se trata como error ni se reintenta la entrega — seguir de largo
      // evita mandar el PDF dos veces. La causa de las ejecuciones
      // solapadas sigue sin investigar (ver docs/pruebas-produccion.md).
      if ((insertError as { code?: string }).code === '23505') {
        this.logger.warn(`Informe de ${team.id}/${weekStart} ya generado por otra ejecución concurrente, descartando este intento`);
        return;
      }
      throw insertError;
    }

    if (team.report_recipients?.length) {
      // El informe siempre se entrega como PDF adjunto — a cada destinatario
      // de la lista, siempre por email (migración 0009, decisión explícita:
      // sin selector de canal por destinatario, simplifica).
      const { title, filename, caption } = reportDeliveryText(team.language, team.name, weekStart);
      const pdfBuffer = await this.pdf.fromMarkdown(content, title);

      for (const recipient of team.report_recipients) {
        await this.channels.get('email').sendDocument(recipient, pdfBuffer, filename, caption);
      }
      await this.supabase.db
        .from('reports')
        .update({ delivered_at: new Date().toISOString() })
        .eq('team_id', team.id)
        .eq('week_start', weekStart);
    }
  }

  // Solo si la organización tiene has_executive_summary activado, tiene más
  // de un equipo (con uno solo no hay nada que consolidar) y TODOS sus
  // equipos ya generaron su informe de esta semana — si falta alguno
  // (todavía no llegó a su hora de corte, o falló su generación), se
  // reintenta en el siguiente tick del cron sin volver a generar los que
  // ya existen (reportExists los salta).
  private async maybeGenerateExecutiveSummary(organizationId: string, weekStart: string) {
    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('id, name, language, has_executive_summary, executive_summary_recipients')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;
    if (!org.has_executive_summary) return;

    const alreadyGenerated = await this.orgReportExists(organizationId, weekStart);
    if (alreadyGenerated) return;

    const { data: orgTeams, error: teamsError } = await this.supabase.db
      .from('teams')
      .select('id, name')
      .eq('organization_id', organizationId);
    if (teamsError) throw teamsError;
    if (orgTeams.length < 2) return;

    const { data: reports, error: reportsError } = await this.supabase.db
      .from('reports')
      .select('id, team_id, content_markdown')
      .eq('week_start', weekStart)
      .in(
        'team_id',
        orgTeams.map((t: any) => t.id),
      );
    if (reportsError) throw reportsError;
    if (reports.length !== orgTeams.length) return;

    const content = await this.aggregate.generateExecutiveSummary({
      organizationName: org.name,
      language: org.language,
      teamReports: orgTeams.map((t: any) => ({
        teamName: t.name,
        contentMarkdown: reports.find((r: any) => r.team_id === t.id)?.content_markdown ?? '',
      })),
    });

    const { error: insertError } = await this.supabase.db.from('reports').insert({
      organization_id: organizationId,
      week_start: weekStart,
      content_markdown: content,
      source_report_ids: reports.map((r: any) => r.id),
      generated_at: new Date().toISOString(),
    });
    if (insertError) {
      // Mismo caso que en generateAndDeliver: reports_org_week_unique ya
      // protege contra dos resúmenes ejecutivos duplicados si dos
      // ejecuciones solapadas llegan aquí a la vez — tratarlo como "ya lo
      // generó la otra ejecución" en vez de como fallo.
      if ((insertError as { code?: string }).code === '23505') {
        this.logger.warn(`Resumen ejecutivo de ${organizationId}/${weekStart} ya generado por otra ejecución concurrente, descartando este intento`);
        return;
      }
      throw insertError;
    }

    const recipients: string[] = org.executive_summary_recipients ?? [];
    if (recipients.length > 0) {
      const { title, filename, caption } = executiveSummaryDeliveryText(org.language, org.name, weekStart);
      const pdfBuffer = await this.pdf.fromMarkdown(content, title);

      for (const recipient of recipients) {
        await this.channels.get('email').sendDocument(recipient, pdfBuffer, filename, caption);
      }
      await this.supabase.db
        .from('reports')
        .update({ delivered_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('week_start', weekStart);
    }
  }
}
