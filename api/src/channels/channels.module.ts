import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { ChannelsService } from './channels.service';

@Module({
  providers: [EmailChannel, WhatsappChannel, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
