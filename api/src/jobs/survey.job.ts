import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { SurveyFormService } from '../survey/survey-form.service';
import { dateInTimezone, isWithinWindow } from './date.utils';
import { surveyMessage } from '../account-language';

// Encuesta anónima de un solo envío (no recurrente, ver migración 0018):
// recorre las encuestas sin mandar todavía (surveys.sent_at is null) y, en
// cuanto llega su fecha+hora+timezone propios (no los de la cuenta), la
// manda a todos los miembros activos de todos los equipos de la
// organización y la marca como enviada. Nunca vuelve a mandarse sola.
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

    const { data: surveys, error } = await this.supabase.db
      .from('surveys')
      .select('id, organization_id, questions, scheduled_date, scheduled_time, timezone, organizations(name, language)')
      .is('sent_at', null);
    if (error) throw error;

    for (const survey of surveys ?? []) {
      if (!this.isDue(now, survey)) continue;

      try {
        await this.sendSurvey(survey);
      } catch (err) {
        this.logger.error(`Fallo mandando la encuesta ${survey.id} (organización ${survey.organization_id})`, err as Error);
      }
    }
  }

  // Si hoy es el día programado, solo dentro de la ventana de 15 min de la
  // hora elegida (mismo mecanismo que ReminderJob/ReportJob). Si ya pasó el
  // día programado (p. ej. el cron estuvo caído), se manda en el primer
  // tick que la vea — mejor tarde que nunca, y sin esto una encuesta
  // perdida se queda pendiente para siempre (solo se permite una pendiente
  // por organización a la vez, sin función de cancelar).
  private isDue(now: Date, survey: { scheduled_date: string; scheduled_time: string; timezone: string }): boolean {
    const today = dateInTimezone(now, survey.timezone);
    if (today < survey.scheduled_date) return false;
    if (today > survey.scheduled_date) return true;
    return isWithinWindow(now, survey.timezone, survey.scheduled_time);
  }

  private async sendSurvey(survey: any) {
    const org = survey.organizations;

    const { data: teams, error: teamsError } = await this.supabase.db
      .from('teams')
      .select('id')
      .eq('organization_id', survey.organization_id);
    if (teamsError) throw teamsError;
    const teamIds = (teams ?? []).map((t: any) => t.id);

    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await this.supabase.db
        .from('members')
        .select('id, name, channel, contact')
        .in('team_id', teamIds)
        .eq('active', true);
      if (membersError) throw membersError;

      for (const member of members ?? []) {
        if (!member.contact) continue; // Telegram sin vincular todavía

        const link = this.surveyForm.buildLink(member.id, survey.id, org.language);
        const message = surveyMessage(org.language, member.name, org.name, link);
        try {
          await this.channels.get(member.channel).send(member.contact, message);
        } catch (err) {
          this.logger.error(`Fallo mandando la encuesta a ${member.contact} (${member.channel})`, err as Error);
        }
      }
    }

    const { error: updateError } = await this.supabase.db
      .from('surveys')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', survey.id)
      .is('sent_at', null);
    if (updateError) throw updateError;
  }
}
