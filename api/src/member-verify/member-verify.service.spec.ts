import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { signMemberVerifyToken } from './member-verify-token.util';
import { MemberVerifyService } from './member-verify.service';

const SECRET = 'test-secret';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = { MEMBER_VERIFY_TOKEN_SECRET: SECRET, APP_BASE_URL: 'https://weeklyfeedback.com', ...overrides };
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      update: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakeChannels() {
  const send = jest.fn().mockResolvedValue(undefined);
  const channels = { get: jest.fn(() => ({ send })) } as unknown as ChannelsService;
  return { channels, send };
}

describe('MemberVerifyService.sendVerificationEmail', () => {
  it('manda el email con un link que lleva el idioma de la organización y un token verificable', async () => {
    const supabase = fakeSupabase([{ data: { name: 'Producto', organizations: { name: 'Org', language: 'en' } }, error: null }]);
    const { channels, send } = fakeChannels();
    const service = new MemberVerifyService(supabase, fakeConfig(), channels);

    await service.sendVerificationEmail('member-1', 'Ana', 'ana@example.com', 'team-1');

    expect(send).toHaveBeenCalledWith('ana@example.com', expect.stringContaining('https://weeklyfeedback.com/en/verify-member-email/'));
  });

  it('sin idioma en la organización, cae en "es" (sin prefijo en el link)', async () => {
    const supabase = fakeSupabase([{ data: { name: 'Producto', organizations: { name: 'Org', language: null } }, error: null }]);
    const { channels, send } = fakeChannels();
    const service = new MemberVerifyService(supabase, fakeConfig(), channels);

    await service.sendVerificationEmail('member-1', 'Ana', 'ana@example.com', 'team-1');

    const [, message] = send.mock.calls[0];
    expect(message).toContain('https://weeklyfeedback.com/verify-member-email/');
    expect(message).not.toContain('/en/verify-member-email/');
  });

  it('lanza si falta MEMBER_VERIFY_TOKEN_SECRET, sin mandar ningún email', async () => {
    const supabase = fakeSupabase([{ data: { name: 'Producto', organizations: { name: 'Org', language: 'es' } }, error: null }]);
    const { channels, send } = fakeChannels();
    const service = new MemberVerifyService(supabase, fakeConfig({ MEMBER_VERIFY_TOKEN_SECRET: undefined as any }), channels);

    await expect(service.sendVerificationEmail('member-1', 'Ana', 'ana@example.com', 'team-1')).rejects.toThrow(
      'MEMBER_VERIFY_TOKEN_SECRET no configurada',
    );
    expect(send).not.toHaveBeenCalled();
  });
});

describe('MemberVerifyService.verify', () => {
  it('token válido: marca email_verified_at del member correcto', async () => {
    const token = signMemberVerifyToken('member-1', SECRET);
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const service = new MemberVerifyService(supabase, fakeConfig(), {} as ChannelsService);

    await service.verify(token);

    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[0].value;
    expect(updateBuilder.update).toHaveBeenCalledWith({ email_verified_at: expect.any(String) });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'member-1');
  });

  it('es idempotente: verificar dos veces el mismo token no falla', async () => {
    const token = signMemberVerifyToken('member-1', SECRET);
    const supabase = fakeSupabase([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const service = new MemberVerifyService(supabase, fakeConfig(), {} as ChannelsService);

    await expect(service.verify(token)).resolves.toBeUndefined();
    await expect(service.verify(token)).resolves.toBeUndefined();
  });

  it('rechaza un token inválido o manipulado con 404, sin tocar la base de datos', async () => {
    const supabase = fakeSupabase([]);
    const service = new MemberVerifyService(supabase, fakeConfig(), {} as ChannelsService);

    await expect(service.verify('token-invalido')).rejects.toThrow(NotFoundException);
    expect(supabase.db.from).not.toHaveBeenCalled();
  });
});
