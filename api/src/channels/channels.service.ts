import { Injectable } from '@nestjs/common';
import { Channel, ChannelName } from './channel.interface';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { TelegramChannel } from './telegram.channel';

@Injectable()
export class ChannelsService {
  private readonly registry: Record<ChannelName, Channel>;

  constructor(email: EmailChannel, whatsapp: WhatsappChannel, telegram: TelegramChannel) {
    this.registry = { email, whatsapp, telegram };
  }

  get(name: ChannelName): Channel {
    const channel = this.registry[name];
    if (!channel) {
      throw new Error(`Canal desconocido: ${name}`);
    }
    return channel;
  }
}
