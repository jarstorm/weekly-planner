import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AudioService } from '../audio/audio.service';

// Retención del histórico por plan (organizations.history_retention_months,
// migración 0013): Equipo 1 mes, Organización 6 meses, Custom sin límite
// (NULL, la organización ni se consulta). Corre una vez al día, no cada
// 15 min como el resto de jobs — no es sensible al minuto.
@Injectable()
export class RetentionJob {
  private readonly logger = new Logger(RetentionJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audio: AudioService,
  ) {}

  @Cron('0 4 * * *')
  async run() {
    const { data: orgs, error } = await this.supabase.db
      .from('organizations')
      .select('id, history_retention_months')
      .not('history_retention_months', 'is', null);
    if (error) throw error;

    for (const org of orgs ?? []) {
      try {
        await this.purgeOrganization(org.id, org.history_retention_months);
      } catch (err) {
        this.logger.error(`Fallo purgando histórico de la organización ${org.id}`, err as Error);
      }
    }
  }

  private cutoffDate(retentionMonths: number): string {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - retentionMonths);
    return d.toISOString().slice(0, 10);
  }

  private async purgeOrganization(organizationId: string, retentionMonths: number) {
    const cutoff = this.cutoffDate(retentionMonths);

    const { data: teams, error: teamsError } = await this.supabase.db
      .from('teams')
      .select('id')
      .eq('organization_id', organizationId);
    if (teamsError) throw teamsError;
    const teamIds = (teams ?? []).map((t: any) => t.id);

    if (teamIds.length > 0) {
      // Los audios se borran de Storage antes de borrar la fila que los
      // referencia — al revés, `audio_paths` ya no estaría disponible para
      // saber qué ficheros limpiar.
      const { data: checkinsToPurge, error: audioPathsError } = await this.supabase.db
        .from('checkins')
        .select('audio_paths')
        .in('team_id', teamIds)
        .lt('week_start', cutoff);
      if (audioPathsError) throw audioPathsError;

      const audioPaths = (checkinsToPurge ?? []).flatMap((c: any) => c.audio_paths ?? []);
      if (audioPaths.length > 0) {
        await this.audio.remove(audioPaths);
      }

      const { error: checkinsError } = await this.supabase.db
        .from('checkins')
        .delete()
        .in('team_id', teamIds)
        .lt('week_start', cutoff);
      if (checkinsError) throw checkinsError;

      // Informes DE EQUIPO — los de organización (resumen ejecutivo) van
      // aparte, reports.organization_id nunca coincide con team_id
      // (constraint reports_scope_check en schema.sql).
      const { error: teamReportsError } = await this.supabase.db
        .from('reports')
        .delete()
        .in('team_id', teamIds)
        .lt('week_start', cutoff);
      if (teamReportsError) throw teamReportsError;
    }

    const { error: orgReportsError } = await this.supabase.db
      .from('reports')
      .delete()
      .eq('organization_id', organizationId)
      .lt('week_start', cutoff);
    if (orgReportsError) throw orgReportsError;

    const { error: surveyResponsesError } = await this.supabase.db
      .from('survey_responses')
      .delete()
      .eq('organization_id', organizationId)
      .lt('period', cutoff);
    if (surveyResponsesError) throw surveyResponsesError;

    const { error: surveySubmissionsError } = await this.supabase.db
      .from('survey_submissions')
      .delete()
      .eq('organization_id', organizationId)
      .lt('period', cutoff);
    if (surveySubmissionsError) throw surveySubmissionsError;
  }
}
