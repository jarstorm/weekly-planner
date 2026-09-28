import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';
import { SurveyService } from './survey.service';

const PERIOD_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('survey')
@UseGuards(AuthGuard)
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Get('periods')
  listPeriods(@CurrentUser() user: AuthedUser) {
    return this.survey.listPeriods(user.organizationId);
  }

  @Get('results')
  getResults(@CurrentUser() user: AuthedUser, @Query('period') period?: string) {
    // Sin esto, pedir /survey/results sin ?period= llegaba tal cual a
    // Postgres como el string "undefined" y tiraba un 500 crudo
    // ("invalid input syntax for type date") en vez de un 400 explicando
    // qué falta — visto en producción probando el endpoint a mano.
    if (!period || !PERIOD_RE.test(period)) {
      throw new BadRequestException('period es obligatorio, formato YYYY-MM-DD (primer día del mes, ver GET /survey/periods)');
    }
    return this.survey.getResults(user.organizationId, period);
  }
}
