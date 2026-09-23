import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { TelegramChannel } from './telegram.channel';
import { ChannelsService } from './channels.service';
import { TelegramInfoController } from './telegram-info.controller';

@Module({
  controllers: [TelegramInfoController],
  providers: [EmailChannel, TelegramChannel, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
