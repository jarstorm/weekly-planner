import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { CheckinsModule } from '../checkins/checkins.module';
import { ChannelsModule } from '../channels/channels.module';
import { AggregateModule } from '../aggregate/aggregate.module';
import { PdfModule } from '../pdf/pdf.module';
import { CheckinFormModule } from '../checkin-form/checkin-form.module';
import { SurveyModule } from '../survey/survey.module';
import { ReminderJob } from './reminder.job';
import { ReportJob } from './report.job';
import { SurveyJob } from './survey.job';

@Module({
  imports: [TeamsModule, CheckinsModule, ChannelsModule, AggregateModule, PdfModule, CheckinFormModule, SurveyModule],
  providers: [ReminderJob, ReportJob, SurveyJob],
})
export class JobsModule {}
