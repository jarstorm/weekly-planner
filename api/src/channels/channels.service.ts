import { Injectable } from '@nestjs/common';
import { Channel, ChannelName } from './channel.interface';
import { EmailChannel } from './email.channel';
import { TelegramChannel } from './telegram.channel';

@Injectable()
export class ChannelsService {
  private readonly registry: Record<ChannelName, Channel>;

  constructor(email: EmailChannel, telegram: TelegramChannel) {
    this.registry = { email, telegram };
  }

  get(name: ChannelName): Channel {
    const channel = this.registry[name];
    if (!channel) {
      throw new Error(`Canal desconocido: ${name}`);
    }
    return channel;
  }
}
