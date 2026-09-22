import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { TelegramChannel } from './telegram.channel';
import { ChannelsService } from './channels.service';

@Module({
  providers: [EmailChannel, TelegramChannel, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
