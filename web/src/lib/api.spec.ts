import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => jsonBody,
    ...rest,
  } as Response);
}

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manda credentials:"include" y Content-Type json en cada request', async () => {
    mockFetchOnce({ jsonBody: { ok: true } });
    await api.me();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('devuelve el JSON parseado cuando la respuesta es ok', async () => {
    mockFetchOnce({ jsonBody: { userId: '1', email: 'a@b.com', organizationId: 'org1' } });
    const result = await api.me();
    expect(result).toEqual({ userId: '1', email: 'a@b.com', organizationId: 'org1' });
  });

  it('lanza ApiError con el status y el mensaje del backend cuando la respuesta no es ok', async () => {
    mockFetchOnce({
      ok: false,
      status: 403,
      jsonBody: { message: 'Tu plan permite hasta 1 equipo(s)' },
    });
    await expect(api.listTeams()).rejects.toMatchObject({
      status: 403,
      message: 'Tu plan permite hasta 1 equipo(s)',
    });
    await expect(api.listTeams()).rejects.toBeInstanceOf(ApiError);
  });

  it('cae en un mensaje genérico si el body de error no es JSON válido', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(api.listTeams()).rejects.toMatchObject({ status: 500, message: 'Internal Server Error' });
  });

  it('devuelve undefined en respuestas 204 sin intentar parsear JSON', async () => {
    const jsonSpy = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: jsonSpy,
    } as unknown as Response);
    const result = await api.removeMember('team1', 'member1');
    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('createCheckoutSession manda el plan en el body', async () => {
    mockFetchOnce({ jsonBody: { url: 'https://checkout.stripe.com/xyz' } });
    await api.createCheckoutSession('organizacion');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ plan: 'organizacion' });
  });
});
