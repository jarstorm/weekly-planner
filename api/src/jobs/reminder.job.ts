import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TeamsService } from '../teams/teams.service';
import { ChannelsService } from '../channels/channels.service';
import { dowInTimezone, isWithinWindow } from './date.utils';

// Recorre todos los equipos cada 15 min y manda el recordatorio semanal a
// los miembros activos de los que están en su día/hora configurados
// (teams.reminder_dow / teams.reminder_time) — ver docs/especificaciones-tecnicas.md,
// sección 4, paso 8.
@Injectable()
export class ReminderJob {
  private readonly logger = new Logger(ReminderJob.name);

  constructor(
    private readonly teams: TeamsService,
    private readonly channels: ChannelsService,
  ) {}

  @Cron('*/15 * * * *')
  async run() {
    const now = new Date();
    const allTeams = await this.teams.listAll();

    for (const team of allTeams) {
      if (dowInTimezone(now, team.timezone) !== team.reminder_dow) continue;
      if (!isWithinWindow(now, team.timezone, team.reminder_time)) continue;

      const members = await this.teams.listMembers(team.id);
      for (const member of members) {
        const message = `Hola ${member.name} 👋 Resumen semanal de ${team.name}.\n1️⃣ ¿Qué has hecho esta semana?\n2️⃣ ¿Qué harás la semana que viene?\n3️⃣ ¿Algo bloqueado o que necesites de alguien?`;
        try {
          await this.channels.get(member.channel).send(member.contact, message);
        } catch (err) {
          this.logger.error(`Fallo mandando recordatorio a ${member.contact} (${member.channel})`, err as Error);
        }
      }
    }
  }
}
