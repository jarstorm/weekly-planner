import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { TelegramChannel } from './telegram.channel';
import { ChannelsService } from './channels.service';

@Module({
  providers: [EmailChannel, WhatsappChannel, TelegramChannel, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
