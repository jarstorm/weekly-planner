import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { SurveyFormService } from '../survey/survey-form.service';
import { currentMonthStart, domInTimezone, isWithinWindow } from './date.utils';
import { surveyMessage } from '../account-language';

// Simétrico a ReminderJob (sección 4, paso 9) pero mensual: recorre las
// organizaciones con has_monthly_survey activado y manda el link de la
// encuesta a todos los miembros activos de TODOS sus equipos (la encuesta
// es de cuenta, no por equipo) el día del mes configurado
// (survey_day_of_month), a la hora del recordatorio semanal de la cuenta
// (reminder_time) — no hace falta un horario propio para esto.
@Injectable()
export class SurveyJob {
  private readonly logger = new Logger(SurveyJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly channels: ChannelsService,
    private readonly surveyForm: SurveyFormService,
  ) {}

  @Cron('*/15 * * * *')
  async run() {
    const now = new Date();

    const { data: orgs, error } = await this.supabase.db
      .from('organizations')
      .select('id, name, timezone, reminder_time, survey_day_of_month, survey_questions, language')
      .eq('has_monthly_survey', true);
    if (error) throw error;

    for (const org of orgs ?? []) {
      if (domInTimezone(now, org.timezone) !== org.survey_day_of_month) continue;
      if (!isWithinWindow(now, org.timezone, org.reminder_time)) continue;
      if (!org.survey_questions?.length) continue;

      const period = currentMonthStart(now, org.timezone);
      try {
        await this.sendToOrganization(org, period);
      } catch (err) {
        this.logger.error(`Fallo mandando la encuesta mensual a la organización ${org.id}`, err as Error);
      }
    }
  }

  private async sendToOrganization(org: any, period: string) {
    const { data: teams, error: teamsError } = await this.supabase.db
      .from('teams')
      .select('id')
      .eq('organization_id', org.id);
    if (teamsError) throw teamsError;
    const teamIds = (teams ?? []).map((t: any) => t.id);
    if (teamIds.length === 0) return;

    const { data: members, error: membersError } = await this.supabase.db
      .from('members')
      .select('id, name, channel, contact')
      .in('team_id', teamIds)
      .eq('active', true);
    if (membersError) throw membersError;

    const { data: submitted, error: submittedError } = await this.supabase.db
      .from('survey_submissions')
      .select('member_id')
      .eq('organization_id', org.id)
      .eq('period', period);
    if (submittedError) throw submittedError;
    const alreadySubmitted = new Set((submitted ?? []).map((s: any) => s.member_id));

    for (const member of members ?? []) {
      if (!member.contact) continue; // Telegram sin vincular todavía
      if (alreadySubmitted.has(member.id)) continue;

      const link = this.surveyForm.buildLink(member.id, period, org.language);
      const message = surveyMessage(org.language, member.name, org.name, link);
      try {
        await this.channels.get(member.channel).send(member.contact, message);
      } catch (err) {
        this.logger.error(`Fallo mandando la encuesta mensual a ${member.contact} (${member.channel})`, err as Error);
      }
    }
  }
}
