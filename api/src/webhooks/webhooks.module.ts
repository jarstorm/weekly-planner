import { Module } from '@nestjs/common';
import { WhatsappWebhookController, TelegramWebhookController } from './webhooks.controller';
import { ChannelsModule } from '../channels/channels.module';
import { CheckinsModule } from '../checkins/checkins.module';

@Module({
  imports: [ChannelsModule, CheckinsModule],
  controllers: [WhatsappWebhookController, TelegramWebhookController],
})
export class WebhooksModule {}
