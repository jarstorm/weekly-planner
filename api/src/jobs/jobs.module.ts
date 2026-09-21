import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { CheckinsModule } from '../checkins/checkins.module';
import { ChannelsModule } from '../channels/channels.module';
import { AggregateModule } from '../aggregate/aggregate.module';
import { ReminderJob } from './reminder.job';
import { ReportJob } from './report.job';

@Module({
  imports: [TeamsModule, CheckinsModule, ChannelsModule, AggregateModule],
  providers: [ReminderJob, ReportJob],
})
export class JobsModule {}
