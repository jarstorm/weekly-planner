import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PdfService } from '../pdf/pdf.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pdf: PdfService,
  ) {}

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

  // Roadmap paso 15: histórico del resumen ejecutivo — mismo criterio de
  // autorización que listForTeam, pero directo por organization_id (no hay
  // team_id que resolver).
  async listForOrg(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('reports')
      .select('id, week_start, content_markdown, generated_at, delivered_at')
      .eq('organization_id', organizationId)
      .order('week_start', { ascending: false });
    if (error) throw error;
    return data;
  }

  // Descarga de un informe pasado en PDF desde el panel — se regenera al
  // vuelo a partir de content_markdown (mismo PdfService que usa ReportJob
  // para la entrega automática) en vez de guardar el binario en Storage:
  // es determinista y barato de regenerar, no hace falta persistirlo
  // aparte (ver docs/especificaciones-tecnicas.md, sección 0.3). Sirve
  // tanto informes de equipo como el resumen ejecutivo de organización
  // (reports.team_id/organization_id son mutuamente excluyentes, sección 3.4).
  async getPdf(organizationId: string, reportId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { data: report, error } = await this.supabase.db
      .from('reports')
      .select('id, week_start, content_markdown, team_id, organization_id, teams(name, organization_id), organizations(name)')
      .eq('id', reportId)
      .maybeSingle();
    if (error) throw error;
    if (!report) throw new NotFoundException('Informe no encontrado');

    const team = (report as any).teams;
    const org = (report as any).organizations;

    if (report.team_id) {
      if (!team || team.organization_id !== organizationId) {
        throw new ForbiddenException('Este informe no pertenece a tu organización');
      }
      const title = `Resumen semanal — ${team.name} — semana del ${report.week_start}`;
      const buffer = await this.pdf.fromMarkdown(report.content_markdown ?? '', title);
      return { buffer, filename: `resumen-semanal-${report.week_start}.pdf` };
    }

    if (report.organization_id !== organizationId) {
      throw new ForbiddenException('Este informe no pertenece a tu organización');
    }
    const title = `Resumen ejecutivo — ${org.name} — semana del ${report.week_start}`;
    const buffer = await this.pdf.fromMarkdown(report.content_markdown ?? '', title);
    return { buffer, filename: `resumen-ejecutivo-${report.week_start}.pdf` };
  }
}
