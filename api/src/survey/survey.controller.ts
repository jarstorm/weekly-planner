import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';
import { SurveyService } from './survey.service';

@Controller('survey')
@UseGuards(AuthGuard)
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Get('periods')
  listPeriods(@CurrentUser() user: AuthedUser) {
    return this.survey.listPeriods(user.organizationId);
  }

  @Get('results')
  getResults(@CurrentUser() user: AuthedUser, @Query('period') period: string) {
    return this.survey.getResults(user.organizationId, period);
  }
}
