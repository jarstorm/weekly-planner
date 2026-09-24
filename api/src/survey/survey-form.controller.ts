import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SurveyFormService } from './survey-form.service';
import { SubmitSurveyFormDto } from './dto/submit-survey-form.dto';

// Sin AuthGuard, mismo criterio que CheckinFormController: el token firmado
// en la URL es la credencial, el empleado no tiene cuenta.
@Controller('survey/form')
export class SurveyFormController {
  constructor(private readonly surveyForm: SurveyFormService) {}

  @Get()
  get(@Query('token') token: string) {
    return this.surveyForm.getForm(token);
  }

  @Post()
  submit(@Body() dto: SubmitSurveyFormDto) {
    return this.surveyForm.submit(dto);
  }
}
