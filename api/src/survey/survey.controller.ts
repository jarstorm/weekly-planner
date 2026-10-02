import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';
import { SurveyService } from './survey.service';
import { CreateSurveyDto } from './dto/create-survey.dto';

@Controller('survey')
@UseGuards(AuthGuard)
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateSurveyDto) {
    return this.survey.createSurvey(user.organizationId, dto);
  }

  @Get('pending')
  getPending(@CurrentUser() user: AuthedUser) {
    return this.survey.getPendingSurvey(user.organizationId);
  }

  @Get('list')
  list(@CurrentUser() user: AuthedUser) {
    return this.survey.listSurveys(user.organizationId);
  }

  @Get('results')
  getResults(@CurrentUser() user: AuthedUser, @Query('surveyId') surveyId?: string) {
    // Sin esto, pedir /survey/results sin ?surveyId= llegaba tal cual a
    // Postgres como el string "undefined" y tiraba un 500 crudo en vez de
    // un 400 explicando qué falta — mismo criterio que antes con ?period=.
    if (!surveyId) {
      throw new BadRequestException('surveyId es obligatorio (ver GET /survey/list)');
    }
    return this.survey.getResults(user.organizationId, surveyId);
  }
}
