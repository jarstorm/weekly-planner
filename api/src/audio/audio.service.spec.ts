import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AudioService } from './audio.service';

function fakeConfig(apiKey: string | undefined): ConfigService {
  return { get: jest.fn(() => apiKey) } as unknown as ConfigService;
}

function fakeSupabaseStorage(responses: Array<{ data?: any; error?: any }>): { supabase: SupabaseService; from: jest.Mock } {
  let i = 0;
  const upload = jest.fn(() => Promise.resolve(responses[i++]));
  const remove = jest.fn(() => Promise.resolve(responses[i++]));
  const createSignedUrl = jest.fn(() => Promise.resolve(responses[i++]));
  const from = jest.fn(() => ({ upload, remove, createSignedUrl }));
  return { supabase: { db: { storage: { from } } } as unknown as SupabaseService, from };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('AudioService.transcribe', () => {
  it('lanza si falta GROQ_API_KEY, sin llegar a llamar a la API', async () => {
    global.fetch = jest.fn();
    const service = new AudioService(fakeConfig(undefined), {} as SupabaseService);

    await expect(service.transcribe(Buffer.from('audio'), 'nota.ogg', 'audio/ogg')).rejects.toThrow('GROQ_API_KEY no configurada');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('devuelve el texto transcrito, recortado de espacios', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ text: '  hola, esto es una prueba  ' }) });
    const service = new AudioService(fakeConfig('groq-key'), {} as SupabaseService);

    const result = await service.transcribe(Buffer.from('audio'), 'nota.ogg', 'audio/ogg');

    expect(result).toBe('hola, esto es una prueba');
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(options.headers.Authorization).toBe('Bearer groq-key');
  });

  it('propaga el error con status y cuerpo si Groq responde con fallo', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429, text: () => Promise.resolve('rate limit exceeded') });
    const service = new AudioService(fakeConfig('groq-key'), {} as SupabaseService);

    await expect(service.transcribe(Buffer.from('audio'), 'nota.ogg', 'audio/ogg')).rejects.toThrow(
      'Groq Whisper respondió 429: rate limit exceeded',
    );
  });

  it('sin campo "text" en la respuesta, devuelve string vacío en vez de reventar', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const service = new AudioService(fakeConfig('groq-key'), {} as SupabaseService);

    expect(await service.transcribe(Buffer.from('audio'), 'nota.ogg', 'audio/ogg')).toBe('');
  });
});

describe('AudioService.store', () => {
  it('sube al bucket privado checkin-audio con el content-type correcto y upsert', async () => {
    const { supabase, from } = fakeSupabaseStorage([{ data: { path: 'member-1/2026-01-05-123.ogg' }, error: null }]);
    const service = new AudioService(fakeConfig('groq-key'), supabase);

    const result = await service.store(Buffer.from('audio'), 'member-1/2026-01-05-123.ogg', 'audio/ogg');

    expect(result).toBe('member-1/2026-01-05-123.ogg');
    expect(from).toHaveBeenCalledWith('checkin-audio');
    const uploadCall = from.mock.results[0].value.upload.mock.calls[0];
    expect(uploadCall[0]).toBe('member-1/2026-01-05-123.ogg');
    expect(uploadCall[2]).toEqual({ contentType: 'audio/ogg', upsert: true });
  });

  it('lanza si Storage devuelve error', async () => {
    const { supabase } = fakeSupabaseStorage([{ data: null, error: { message: 'bucket no existe' } }]);
    const service = new AudioService(fakeConfig('groq-key'), supabase);

    await expect(service.store(Buffer.from('audio'), 'x.ogg', 'audio/ogg')).rejects.toEqual({ message: 'bucket no existe' });
  });
});

describe('AudioService.remove', () => {
  it('no llama a Storage si la lista de paths está vacía', async () => {
    const { supabase, from } = fakeSupabaseStorage([]);
    const service = new AudioService(fakeConfig('groq-key'), supabase);

    await service.remove([]);

    expect(from).not.toHaveBeenCalled();
  });

  it('borra todos los paths de una sola llamada', async () => {
    const { supabase, from } = fakeSupabaseStorage([{ data: null, error: null }]);
    const service = new AudioService(fakeConfig('groq-key'), supabase);

    await service.remove(['a.ogg', 'b.ogg']);

    expect(from.mock.results[0].value.remove).toHaveBeenCalledWith(['a.ogg', 'b.ogg']);
  });
});

describe('AudioService.getSignedUrl', () => {
  it('devuelve la signedUrl con 1h de validez', async () => {
    const { supabase, from } = fakeSupabaseStorage([{ data: { signedUrl: 'https://supabase.co/signed/x' }, error: null }]);
    const service = new AudioService(fakeConfig('groq-key'), supabase);

    const result = await service.getSignedUrl('member-1/audio.ogg');

    expect(result).toBe('https://supabase.co/signed/x');
    expect(from.mock.results[0].value.createSignedUrl).toHaveBeenCalledWith('member-1/audio.ogg', 3600);
  });
});
