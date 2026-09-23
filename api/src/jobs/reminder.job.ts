import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TeamsService } from '../teams/teams.service';
import { ChannelsService } from '../channels/channels.service';
import { CheckinFormService } from '../checkin-form/checkin-form.service';
import { currentWeekStart, dowInTimezone, isWithinWindow } from './date.utils';

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
    private readonly checkinForm: CheckinFormService,
  ) {}

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

        // El link con token propio (sección 3.5) es lo único que le
        // permite a alguien con canal email contestar — email no es
        // conversacional como Telegram, no hay a qué "responder".
        // Se manda igual en los dos canales, no solo email: no molesta
        // en un chat y da una alternativa si prefieren no escribir texto libre.
        const link = this.checkinForm.buildLink(member.id, weekStart);
        const message = `Hola ${member.name} 👋 Resumen semanal de ${team.name}.\n1️⃣ ¿Qué has hecho esta semana?\n2️⃣ ¿Qué harás la semana que viene?\n3️⃣ ¿Algo bloqueado o que necesites de alguien?\n\nTambién puedes responder aquí: ${link}`;
        try {
          await this.channels.get(member.channel).send(member.contact, message);
        } catch (err) {
          this.logger.error(`Fallo mandando recordatorio a ${member.contact} (${member.channel})`, err as Error);
        }
      }
    }
  }
}
