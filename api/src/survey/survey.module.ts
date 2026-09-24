import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SurveyController } from './survey.controller';
import { SurveyService } from './survey.service';
import { SurveyFormController } from './survey-form.controller';
import { SurveyFormService } from './survey-form.service';

@Module({
  imports: [AuthModule],
  controllers: [SurveyController, SurveyFormController],
  providers: [SurveyService, SurveyFormService],
  exports: [SurveyFormService],
})
export class SurveyModule {}
