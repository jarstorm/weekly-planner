import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { CheckinsService } from '../checkins/checkins.service';
import { signCheckinToken } from './token.util';
import { CheckinFormService } from './checkin-form.service';

const SECRET = 'test-secret';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = { CHECKIN_TOKEN_SECRET: SECRET, APP_BASE_URL: 'https://weeklyfeedback.com', ...overrides };
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

// Mismo patrón de cola de respuestas que teams.service.spec.ts.
function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakeCheckins(): { checkins: CheckinsService; saveInternal: jest.Mock } {
  const saveInternal = jest.fn().mockResolvedValue(undefined);
  return { checkins: { saveInternal } as unknown as CheckinsService, saveInternal };
}

describe('CheckinFormService.buildLink', () => {
  it('sin prefijo de idioma para "es" (default)', () => {
    const service = new CheckinFormService(fakeConfig(), {} as SupabaseService, {} as CheckinsService);

    const link = service.buildLink('member-1', '2026-01-05', 'es');

    expect(link).toMatch(/^https:\/\/weeklyfeedback\.com\/checkin\/[^/]+~[^/]+$/);
  });

  it('con prefijo /en para inglés', () => {
    const service = new CheckinFormService(fakeConfig(), {} as SupabaseService, {} as CheckinsService);

    const link = service.buildLink('member-1', '2026-01-05', 'en');

    expect(link).toContain('https://weeklyfeedback.com/en/checkin/');
  });

  it('lanza si falta CHECKIN_TOKEN_SECRET — nunca firma con un secreto vacío', () => {
    const service = new CheckinFormService(fakeConfig({ CHECKIN_TOKEN_SECRET: undefined as any }), {} as SupabaseService, {} as CheckinsService);

    expect(() => service.buildLink('member-1', '2026-01-05')).toThrow('CHECKIN_TOKEN_SECRET no configurada');
  });
});

describe('CheckinFormService.getForm', () => {
  it('token con firma inválida (manipulado) es rechazado como enlace inválido', async () => {
    const service = new CheckinFormService(fakeConfig(), {} as SupabaseService, {} as CheckinsService);

    await expect(service.getForm('payload-falso~firma-falsa')).rejects.toThrow(NotFoundException);
  });

  it('token válido pero firmado con otro secreto (p. ej. de otro entorno) es rechazado', async () => {
    const token = signCheckinToken({ memberId: 'member-1', weekStart: '2026-01-05' }, 'otro-secreto');
    const service = new CheckinFormService(fakeConfig(), {} as SupabaseService, {} as CheckinsService);

    await expect(service.getForm(token)).rejects.toThrow(NotFoundException);
  });

  it('token válido pero de un member que ya no existe (borrado) es rechazado', async () => {
    const token = signCheckinToken({ memberId: 'member-1', weekStart: '2026-01-05' }, SECRET);
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const service = new CheckinFormService(fakeConfig(), supabase, {} as CheckinsService);

    await expect(service.getForm(token)).rejects.toThrow(NotFoundException);
  });

  it('devuelve los datos del member/equipo y alreadySubmitted=false si no hay checkin esa semana', async () => {
    const token = signCheckinToken({ memberId: 'member-1', weekStart: '2026-01-05' }, SECRET);
    const supabase = fakeSupabase([
      { data: { id: 'member-1', name: 'Ana', team_id: 'team-1', teams: { name: 'Producto' } }, error: null },
      { data: null, error: null }, // sin checkin todavía
    ]);
    const service = new CheckinFormService(fakeConfig(), supabase, {} as CheckinsService);

    const result = await service.getForm(token);

    expect(result).toEqual({ memberName: 'Ana', teamName: 'Producto', weekStart: '2026-01-05', alreadySubmitted: false });
  });

  it('alreadySubmitted=true si ya existe un checkin para ese member/semana', async () => {
    const token = signCheckinToken({ memberId: 'member-1', weekStart: '2026-01-05' }, SECRET);
    const supabase = fakeSupabase([
      { data: { id: 'member-1', name: 'Ana', team_id: 'team-1', teams: { name: 'Producto' } }, error: null },
      { data: { id: 'checkin-1' }, error: null },
    ]);
    const service = new CheckinFormService(fakeConfig(), supabase, {} as CheckinsService);

    const result = await service.getForm(token);

    expect(result.alreadySubmitted).toBe(true);
  });
});

describe('CheckinFormService.submit', () => {
  it('guarda el checkin del member/semana resueltos por el token, no por lo que mande el cliente', async () => {
    const token = signCheckinToken({ memberId: 'member-1', weekStart: '2026-01-05' }, SECRET);
    const supabase = fakeSupabase([{ data: { id: 'member-1', name: 'Ana', team_id: 'team-1', teams: { name: 'Producto' } }, error: null }]);
    const { checkins, saveInternal } = fakeCheckins();
    const service = new CheckinFormService(fakeConfig(), supabase, checkins);

    const result = await service.submit({ token, doneText: 'hecho', nextText: 'próximo', blockerText: '' });

    expect(result).toEqual({ ok: true });
    expect(saveInternal).toHaveBeenCalledWith({
      team_id: 'team-1',
      member_id: 'member-1',
      week_start: '2026-01-05',
      done_text: 'hecho',
      next_text: 'próximo',
      blocker_text: '',
    });
  });

  it('un token inválido nunca llega a guardar nada', async () => {
    const { checkins, saveInternal } = fakeCheckins();
    const service = new CheckinFormService(fakeConfig(), {} as SupabaseService, checkins);

    await expect(service.submit({ token: 'invalido', doneText: 'x', nextText: 'y', blockerText: 'z' })).rejects.toThrow(NotFoundException);
    expect(saveInternal).not.toHaveBeenCalled();
  });
});
