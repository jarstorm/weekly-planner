import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TeamsService } from '../teams/teams.service';
import { ChannelsService } from '../channels/channels.service';
import { WhatsappChannel } from '../channels/whatsapp.channel';
import { CheckinFormService } from '../checkin-form/checkin-form.service';
import { currentWeekStart, dowInTimezone, isWithinWindow } from './date.utils';
import { reminderMessage } from '../account-language';

// Nombre exacto de la plantilla aprobada en Meta (WhatsApp Manager >
// Plantillas de mensaje), una versión "es" y otra "en" — mismo nombre,
// `language.code` distingue cuál usar. Subir la versión (v5, v6...) si se
// edita el texto: Meta trata cada edición como plantilla nueva a re-aprobar.
const REMINDER_TEMPLATE_NAME = 'weekly_reminder_v4';

// Recorre todos los equipos cada 15 min y manda el recordatorio semanal a
// los miembros activos de los que están en su día/hora configurados —
// horario de cuenta, no por equipo (organizations.reminder_dow /
// reminder_time, migración 0006, aplanado sobre cada equipo por
// TeamsService.listAll) — ver docs/especificaciones-tecnicas.md, sección 4, paso 8.
@Injectable()
export class ReminderJob {
  private readonly logger = new Logger(ReminderJob.name);

  constructor(
    private readonly teams: TeamsService,
    private readonly channels: ChannelsService,
    private readonly whatsapp: WhatsappChannel,
    private readonly checkinForm: CheckinFormService,
  ) {}

  // Sigue en 15 min a propósito, a diferencia de ReportJob — este job NO
  // es idempotente por miembro (no comprueba si ya se le mandó el
  // recordatorio esta semana, solo que tenga contact). Bajarlo a 5 min con
  // la ventana en 15 mandaría el recordatorio 3 veces a todo el mundo, no
  // solo reintentar a los que fallaron — haría falta una tabla de
  // "recordatorio enviado" por miembro/semana antes de poder acortarlo.
  @Cron('*/15 * * * *')
  async run() {
    const now = new Date();
    const allTeams = await this.teams.listAll();

    for (const team of allTeams) {
      if (dowInTimezone(now, team.timezone) !== team.reminder_dow) continue;
      if (!isWithinWindow(now, team.timezone, team.reminder_time)) continue;

      const weekStart = currentWeekStart(now, team.timezone);
      const members = await this.teams.listMembers(team.id);
      for (const member of members) {
        // Telegram sin vincular todavía (contact null, ver webhooks.controller#linkMember)
        // — nada que mandar hasta que la persona abra el bot.
        if (!member.contact) continue;

        try {
          if (member.channel === 'whatsapp') {
            // Business-initiated, sin conversación abierta previa — hace
            // falta la plantilla aprobada por Meta, no texto libre (ver
            // WhatsappChannel.sendTemplate). Su cuerpo ya trae el nombre,
            // el equipo y la hora de corte; no lleva el link del formulario
            // web como los otros canales, así que no se usa `reminderMessage`.
            const cutoff = team.cutoff_time.slice(0, 5);
            await this.whatsapp.sendTemplate(member.contact, REMINDER_TEMPLATE_NAME, team.language, [
              member.name,
              team.name,
              cutoff,
            ]);
          } else {
            const link = this.checkinForm.buildLink(member.id, weekStart, team.language);
            const message = reminderMessage(team.language, member.name, team.name, link);
            await this.channels.get(member.channel).send(member.contact, message);
          }
        } catch (err) {
          this.logger.error(`Fallo mandando recordatorio a ${member.contact} (${member.channel})`, err as Error);
        }
      }
    }
  }
}
