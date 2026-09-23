import { ConfigService } from '@nestjs/config';
import { TelegramChannel } from './telegram.channel';

describe('TelegramChannel#parseIncoming — deep link de vinculación', () => {
  const channel = new TelegramChannel({} as ConfigService);

  it('extrae el member_id de "/start <member_id>" (deep link t.me/<bot>?start=)', async () => {
    const payload = { message: { chat: { id: 12345 }, text: '/start abc-123' } };

    const result = await channel.parseIncoming(payload);

    expect(result).toEqual({ contact: '12345', rawText: '', startParam: 'abc-123' });
  });

  it('extrae el member_id con "/start@bot_username <member_id>" (grupos/deep link con @bot)', async () => {
    const payload = { message: { chat: { id: 12345 }, text: '/start@weeklyfeedback_bot abc-123' } };

    const result = await channel.parseIncoming(payload);

    expect(result.startParam).toBe('abc-123');
  });

  it('"/start" sin parámetro (alguien lo manda a mano) deja startParam undefined', async () => {
    const payload = { message: { chat: { id: 12345 }, text: '/start' } };

    const result = await channel.parseIncoming(payload);

    expect(result).toEqual({ contact: '12345', rawText: '', startParam: undefined });
  });

  it('un checkin normal no tiene startParam, sigue el camino de siempre', async () => {
    const payload = { message: { chat: { id: 12345 }, text: 'esta semana bien, sin bloqueos' } };

    const result = await channel.parseIncoming(payload);

    expect(result).toEqual({ contact: '12345', rawText: 'esta semana bien, sin bloqueos' });
  });
});
