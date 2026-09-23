import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { CheckinsService } from '../checkins/checkins.service';
import { AudioService } from '../audio/audio.service';
import { TelegramWebhookController } from './webhooks.controller';

// Mismo patrón de cola de respuestas que teams.service.spec.ts — evita
// levantar un Supabase real para probar linkMember (vinculación por deep
// link, ver telegram.channel.ts).
function fakeSupabase(responses: Array<{ data?: any; error?: any; count?: number }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      update: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakeChannels(parsed: any, send = jest.fn()) {
  const bot = { parseIncoming: jest.fn().mockResolvedValue(parsed), send };
  const get = jest.fn(() => bot);
  return { channels: { get } as unknown as ChannelsService, send };
}

describe('TelegramWebhookController — vinculación por deep link (/start <member_id>)', () => {
  it('vincula el chat_id al member cuando el deep link apunta a uno válido de canal telegram', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'member-1' }, error: null }, // members.select por id+channel
      { data: null, error: null }, // update contact
    ]);
    const { channels, send } = fakeChannels({ contact: '999', rawText: '', startParam: 'member-1' });
    const controller = new TelegramWebhookController(channels, {} as CheckinsService, {} as AudioService, supabase);

    const result = await controller.receive({});

    expect(result).toEqual({ ok: true, linked: true });
    expect(send).toHaveBeenCalledWith('999', expect.stringContaining('A partir de ahora'));
  });

  it('avisa de enlace inválido si el member_id no existe o no es de canal telegram', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const { channels, send } = fakeChannels({ contact: '999', rawText: '', startParam: 'no-existe' });
    const controller = new TelegramWebhookController(channels, {} as CheckinsService, {} as AudioService, supabase);

    const result = await controller.receive({});

    expect(result).toEqual({ ok: true, linked: false });
    expect(send).toHaveBeenCalledWith('999', expect.stringContaining('no es válido'));
  });

  it('un mensaje sin startParam no toca linkMember, sigue el camino normal de checkin', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]); // matchMemberAndSaveCheckin: sin member
    const { channels, send } = fakeChannels({ contact: '999', rawText: 'todo bien' });
    const controller = new TelegramWebhookController(channels, {} as CheckinsService, {} as AudioService, supabase);

    const result = await controller.receive({});

    expect(result).toEqual({ ok: true, matched: false });
    expect(send).not.toHaveBeenCalled();
  });
});
