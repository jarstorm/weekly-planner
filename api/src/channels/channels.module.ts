import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { TelegramChannel } from './telegram.channel';
import { ChannelsService } from './channels.service';
import { TelegramInfoController } from './telegram-info.controller';
import { ChannelsInfoController } from './channels-info.controller';

@Module({
  controllers: [TelegramInfoController, ChannelsInfoController],
  providers: [EmailChannel, WhatsappChannel, TelegramChannel, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
