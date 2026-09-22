import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './webhooks.controller';
import { ChannelsModule } from '../channels/channels.module';
import { CheckinsModule } from '../checkins/checkins.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [ChannelsModule, CheckinsModule, AudioModule],
  controllers: [TelegramWebhookController],
})
export class WebhooksModule {}
