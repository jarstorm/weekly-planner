import { SupabaseService } from '../supabase/supabase.service';
import { AudioService } from '../audio/audio.service';
import { CheckinsService } from './checkins.service';

// Mismo patrón de cola de respuestas que teams.service.spec.ts.
function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      upsert: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(result)),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

const fakeAudio = {} as AudioService;

describe('CheckinsService — appendIncoming (migración 0014)', () => {
  it('primer mensaje de la semana: raw_text es el mensaje tal cual, sin concatenar nada', async () => {
    const supabase = fakeSupabase([
      { data: null, error: null }, // no había checkin todavía
      { data: { raw_text: 'hola', audio_paths: [] }, error: null }, // upsert
    ]);
    const service = new CheckinsService(supabase, fakeAudio);

    await service.appendIncoming({ team_id: 't1', member_id: 'm1', week_start: '2026-09-21', text: 'hola' });

    const upsertBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ raw_text: 'hola', audio_paths: [] }),
      { onConflict: 'member_id,week_start' },
    );
  });

  it('segundo mensaje de texto se concatena al anterior con un separador, no lo pisa', async () => {
    const supabase = fakeSupabase([
      { data: { raw_text: 'primero', audio_paths: [] }, error: null },
      { data: null, error: null },
    ]);
    const service = new CheckinsService(supabase, fakeAudio);

    await service.appendIncoming({ team_id: 't1', member_id: 'm1', week_start: '2026-09-21', text: 'segundo' });

    const upsertBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(upsertBuilder.upsert.mock.calls[0][0].raw_text).toBe('primero\n\nsegundo');
  });

  it('una nota de voz nueva se añade a audio_paths sin pisar las anteriores', async () => {
    const supabase = fakeSupabase([
      { data: { raw_text: null, audio_paths: ['a.ogg'] }, error: null },
      { data: null, error: null },
    ]);
    const service = new CheckinsService(supabase, fakeAudio);

    await service.appendIncoming({ team_id: 't1', member_id: 'm1', week_start: '2026-09-21', audioPath: 'b.ogg' });

    const upsertBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(upsertBuilder.upsert.mock.calls[0][0].audio_paths).toEqual(['a.ogg', 'b.ogg']);
  });

  it('sin mensaje de texto en esta llamada, conserva el raw_text existente tal cual', async () => {
    const supabase = fakeSupabase([
      { data: { raw_text: 'ya había algo', audio_paths: [] }, error: null },
      { data: null, error: null },
    ]);
    const service = new CheckinsService(supabase, fakeAudio);

    await service.appendIncoming({ team_id: 't1', member_id: 'm1', week_start: '2026-09-21', audioPath: 'nota.ogg' });

    const upsertBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(upsertBuilder.upsert.mock.calls[0][0].raw_text).toBe('ya había algo');
  });
});
