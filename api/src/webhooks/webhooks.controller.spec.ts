import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { CheckinsService } from '../checkins/checkins.service';
import { AudioService } from '../audio/audio.service';
import { TelegramWebhookController, WhatsappWebhookController } from './webhooks.controller';

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

function fakeCheckins(): { checkins: CheckinsService; appendIncoming: jest.Mock } {
  const appendIncoming = jest.fn().mockResolvedValue(undefined);
  return { checkins: { appendIncoming } as unknown as CheckinsService, appendIncoming };
}

function fakeAudio(transcription = 'transcrito: hola'): { audio: AudioService; store: jest.Mock; transcribe: jest.Mock } {
  const store = jest.fn().mockResolvedValue('path/al/audio.ogg');
  const transcribe = jest.fn().mockResolvedValue(transcription);
  return { audio: { store, transcribe } as unknown as AudioService, store, transcribe };
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

describe('matchMemberAndSaveCheckin — camino normal de checkin (vía TelegramWebhookController)', () => {
  it('guarda el checkin de texto del member matcheado por (contact, channel, active=true)', async () => {
    const member = { id: 'member-1', team_id: 'team-1', teams: { organizations: { timezone: 'Europe/Madrid' } } };
    const supabase = fakeSupabase([{ data: member, error: null }]);
    const { channels, send } = fakeChannels({ contact: '999', rawText: 'Esta semana: hecho todo' });
    const { checkins, appendIncoming } = fakeCheckins();
    const controller = new TelegramWebhookController(channels, checkins, {} as AudioService, supabase);

    const result = await controller.receive({});

    expect(result).toEqual({ ok: true, matched: true });
    expect(appendIncoming).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'team-1',
        member_id: 'member-1',
        text: 'Esta semana: hecho todo',
        audioPath: undefined,
      }),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('con nota de voz: guarda el audio en Storage antes de transcribir, y guarda el checkin con el texto transcrito, no el rawText vacío', async () => {
    const member = { id: 'member-1', team_id: 'team-1', teams: { organizations: { timezone: 'Europe/Madrid' } } };
    const supabase = fakeSupabase([{ data: member, error: null }]);
    const audioPayload = { buffer: Buffer.from('ogg-bytes'), mimeType: 'audio/ogg', extension: 'ogg' };
    const { channels } = fakeChannels({ contact: '999', rawText: '', audio: audioPayload });
    const { checkins, appendIncoming } = fakeCheckins();
    const { audio, store, transcribe } = fakeAudio('transcripción real de la nota de voz');
    const controller = new TelegramWebhookController(channels, checkins, audio, supabase);

    const result = await controller.receive({});

    expect(result).toEqual({ ok: true, matched: true });
    // El audio se guarda ANTES de transcribir — si la transcripción falla, no se pierde.
    const storeOrder = store.mock.invocationCallOrder[0];
    const transcribeOrder = transcribe.mock.invocationCallOrder[0];
    expect(storeOrder).toBeLessThan(transcribeOrder);
    expect(store).toHaveBeenCalledWith(audioPayload.buffer, expect.stringMatching(/^member-1\/.+\.ogg$/), 'audio/ogg');
    expect(appendIncoming).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'transcripción real de la nota de voz', audioPath: expect.stringMatching(/\.ogg$/) }),
    );
  });

  it('un payload que el canal no reconoce se convierte en 400, no en 500', async () => {
    const supabase = fakeSupabase([]);
    const bot = { parseIncoming: jest.fn().mockRejectedValue(new Error('sin mensaje reconocible')) };
    const channels = { get: jest.fn(() => bot) } as unknown as ChannelsService;
    const controller = new TelegramWebhookController(channels, {} as CheckinsService, {} as AudioService, supabase);

    await expect(controller.receive({})).rejects.toThrow(BadRequestException);
    await expect(controller.receive({})).rejects.toThrow('sin mensaje reconocible');
  });
});

function fakeConfig(token: string): ConfigService {
  return { get: jest.fn(() => token) } as unknown as ConfigService;
}

describe('WhatsappWebhookController — verificación del webhook (GET, hub.challenge)', () => {
  it('devuelve el challenge si mode=subscribe y el verify_token coincide con el configurado', () => {
    const controller = new WhatsappWebhookController(
      fakeConfig('secreto-real'),
      {} as ChannelsService,
      {} as CheckinsService,
      {} as AudioService,
      {} as SupabaseService,
    );

    const result = controller.verify('subscribe', 'secreto-real', 'challenge-123');

    expect(result).toBe('challenge-123');
  });

  it('rechaza con 400 si el verify_token no coincide (nunca devuelve el challenge a quien no lo sabe)', () => {
    const controller = new WhatsappWebhookController(
      fakeConfig('secreto-real'),
      {} as ChannelsService,
      {} as CheckinsService,
      {} as AudioService,
      {} as SupabaseService,
    );

    expect(() => controller.verify('subscribe', 'adivinado', 'challenge-123')).toThrow(BadRequestException);
  });
});

describe('WhatsappWebhookController — recepción (POST)', () => {
  it('un evento de "statuses" (confirmación de entrega) se loguea y no toca checkins ni llama a parseIncoming', async () => {
    const parseIncoming = jest.fn();
    const channels = { get: jest.fn(() => ({ parseIncoming })) } as unknown as ChannelsService;
    const { checkins, appendIncoming } = fakeCheckins();
    const controller = new WhatsappWebhookController(fakeConfig('x'), channels, checkins, {} as AudioService, {} as SupabaseService);
    const payload = {
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', recipient_id: '+34600', status: 'delivered' }] } }] }],
    };

    const result = await controller.receive(payload);

    expect(result).toEqual({ ok: true });
    expect(parseIncoming).not.toHaveBeenCalled();
    expect(appendIncoming).not.toHaveBeenCalled();
  });

  it('un mensaje entrante real se resuelve igual que en Telegram: matchea member y guarda el checkin', async () => {
    const member = { id: 'member-1', team_id: 'team-1', teams: { organizations: { timezone: 'Europe/Madrid' } } };
    const supabase = fakeSupabase([{ data: member, error: null }]);
    const { channels, send } = fakeChannels({ contact: '+34600000000', rawText: 'todo bien esta semana' });
    const { checkins, appendIncoming } = fakeCheckins();
    const controller = new WhatsappWebhookController(fakeConfig('x'), channels, checkins, {} as AudioService, supabase);

    const result = await controller.receive({ entry: [{ changes: [{ value: {} }] }] });

    expect(result).toEqual({ ok: true, matched: true });
    expect(appendIncoming).toHaveBeenCalledWith(expect.objectContaining({ member_id: 'member-1', text: 'todo bien esta semana' }));
    expect(send).not.toHaveBeenCalled();
  });
});
