import { ConfigService } from '@nestjs/config';
import { AggregateService } from './aggregate.service';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('AggregateService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws if GROQ_API_KEY is missing', async () => {
    const service = new AggregateService(fakeConfig({}));
    await expect(
      service.generateReport({
        teamName: 'Studio Creativo',
        companyContext: '',
        checkins: [],
        membersWithoutResponse: [],
        pastBlockers: [],
      }),
    ).rejects.toThrow('GROQ_API_KEY');
  });

  it('sends the prompt built from mvp-resumen-semanal-equipos.md, sección 10, to the Groq API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'informe generado' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new AggregateService(
      fakeConfig({ GROQ_API_KEY: 'gsk-test', GROQ_MODEL: 'openai/gpt-oss-120b' }),
    );

    const result = await service.generateReport({
      teamName: 'Studio Creativo',
      companyContext: 'Lanzamos la v2 en octubre',
      checkins: [
        { memberName: 'Marta', doneText: 'Cerró la campaña', nextText: 'Presentación', blockerText: null },
      ],
      membersWithoutResponse: ['Diego'],
      pastBlockers: ['Marta lleva 2 semanas esperando feedback de Cliente X'],
    });

    expect(result).toBe('informe generado');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer gsk-test');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('openai/gpt-oss-120b');
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('Studio Creativo');
    expect(prompt).toContain('Lanzamos la v2 en octubre');
    expect(prompt).toContain('Marta: hecho: Cerró la campaña');
    expect(prompt).toContain('Sin respuesta esta semana: Diego');
    expect(prompt).toContain('Marta lleva 2 semanas esperando feedback');
  });

  it('throws with the response body when the Groq API errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    }) as unknown as typeof fetch;

    const service = new AggregateService(fakeConfig({ GROQ_API_KEY: 'gsk-test' }));

    await expect(
      service.generateReport({
        teamName: 'X',
        companyContext: '',
        checkins: [],
        membersWithoutResponse: [],
        pastBlockers: [],
      }),
    ).rejects.toThrow('Groq API respondió 500');
  });
});
