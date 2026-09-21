import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ChannelsModule } from '../channels/channels.module';
import { CheckinsModule } from '../checkins/checkins.module';

@Module({
  imports: [ChannelsModule, CheckinsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
