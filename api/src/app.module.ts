import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { TeamsModule } from './teams/teams.module';
import { CheckinsModule } from './checkins/checkins.module';
import { AggregateModule } from './aggregate/aggregate.module';
import { JobsModule } from './jobs/jobs.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReportsModule } from './reports/reports.module';
import { CheckinFormModule } from './checkin-form/checkin-form.module';
import { BillingModule } from './billing/billing.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SurveyModule } from './survey/survey.module';
import { MemberVerifyModule } from './member-verify/member-verify.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    ChannelsModule,
    TeamsModule,
    CheckinsModule,
    AggregateModule,
    JobsModule,
    WebhooksModule,
    ReportsModule,
    CheckinFormModule,
    BillingModule,
    OrganizationsModule,
    SurveyModule,
    MemberVerifyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
