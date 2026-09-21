import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { ChannelsModule } from './channels/channels.module';
import { TeamsModule } from './teams/teams.module';
import { CheckinsModule } from './checkins/checkins.module';
import { AggregateModule } from './aggregate/aggregate.module';
import { JobsModule } from './jobs/jobs.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    ChannelsModule,
    TeamsModule,
    CheckinsModule,
    AggregateModule,
    JobsModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
