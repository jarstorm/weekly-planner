import { Injectable } from '@nestjs/common';
import { Channel, ChannelName } from './channel.interface';
import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';

@Injectable()
export class ChannelsService {
  private readonly registry: Record<ChannelName, Channel>;

  constructor(email: EmailChannel, whatsapp: WhatsappChannel) {
    this.registry = { email, whatsapp };
  }

  get(name: ChannelName): Channel {
    const channel = this.registry[name];
    if (!channel) {
      throw new Error(`Canal desconocido: ${name}`);
    }
    return channel;
  }
}
