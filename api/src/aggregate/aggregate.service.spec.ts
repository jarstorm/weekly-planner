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

  it('throws if ANTHROPIC_API_KEY is missing', async () => {
    const service = new AggregateService(fakeConfig({}));
    await expect(
      service.generateReport({
        teamName: 'Studio Creativo',
        companyContext: '',
        checkins: [],
        membersWithoutResponse: [],
        pastBlockers: [],
      }),
    ).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('sends the prompt built from mvp-resumen-semanal-equipos.md, sección 10, to the Anthropic API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'informe generado' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new AggregateService(
      fakeConfig({ ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_MODEL: 'claude-sonnet-5' }),
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
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('sk-ant-test');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-sonnet-5');
    const prompt = body.messages[0].content as string;
    expect(prompt).toContain('Studio Creativo');
    expect(prompt).toContain('Lanzamos la v2 en octubre');
    expect(prompt).toContain('Marta: hecho: Cerró la campaña');
    expect(prompt).toContain('Sin respuesta esta semana: Diego');
    expect(prompt).toContain('Marta lleva 2 semanas esperando feedback');
  });

  it('throws with the response body when the Anthropic API errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    }) as unknown as typeof fetch;

    const service = new AggregateService(fakeConfig({ ANTHROPIC_API_KEY: 'sk-ant-test' }));

    await expect(
      service.generateReport({
        teamName: 'X',
        companyContext: '',
        checkins: [],
        membersWithoutResponse: [],
        pastBlockers: [],
      }),
    ).rejects.toThrow('Anthropic API respondió 500');
  });

  it('throws instead of returning an empty report when the API responds 200 without a usable text block', async () => {
    // Visto en producción: la llamada del resumen ejecutivo devolvió 200 OK
    // pero sin bloque de texto aprovechable, y el código anterior entregaba
    // un informe en blanco en vez de fallar (json.content?.[0]?.text ?? '').
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'tool_use', input: {} }] }),
    }) as unknown as typeof fetch;

    const service = new AggregateService(fakeConfig({ ANTHROPIC_API_KEY: 'sk-ant-test' }));

    await expect(
      service.generateReport({
        teamName: 'X',
        companyContext: '',
        checkins: [],
        membersWithoutResponse: [],
        pastBlockers: [],
      }),
    ).rejects.toThrow('Anthropic API devolvió una respuesta sin texto utilizable');
  });
});
