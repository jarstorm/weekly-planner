import { EmailChannel } from './email.channel';
import { WhatsappChannel } from './whatsapp.channel';
import { TelegramChannel } from './telegram.channel';
import { ChannelsService } from './channels.service';

describe('ChannelsService', () => {
  it('get() devuelve el canal correcto por nombre — un desorden en el constructor mandaría el mensaje por el canal equivocado', () => {
    const email = { send: jest.fn(), sendDocument: jest.fn(), parseIncoming: jest.fn() } as unknown as EmailChannel;
    const whatsapp = { send: jest.fn(), sendDocument: jest.fn(), parseIncoming: jest.fn() } as unknown as WhatsappChannel;
    const telegram = { send: jest.fn(), sendDocument: jest.fn(), parseIncoming: jest.fn() } as unknown as TelegramChannel;
    const channels = new ChannelsService(email, whatsapp, telegram);

    expect(channels.get('email')).toBe(email);
    expect(channels.get('whatsapp')).toBe(whatsapp);
    expect(channels.get('telegram')).toBe(telegram);
  });

  it('lanza para un nombre de canal que no existe en el registro', () => {
    const email = {} as unknown as EmailChannel;
    const whatsapp = {} as unknown as WhatsappChannel;
    const telegram = {} as unknown as TelegramChannel;
    const channels = new ChannelsService(email, whatsapp, telegram);

    expect(() => channels.get('slack' as any)).toThrow('Canal desconocido: slack');
  });
});
