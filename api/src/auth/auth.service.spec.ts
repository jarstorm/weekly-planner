import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { AuthService } from './auth.service';
import { signEmailVerificationToken } from './verify-email-token.util';

const SECRET = 'test-secret';

function fakeConfig(): ConfigService {
  const values: Record<string, string> = {
    EMAIL_VERIFICATION_TOKEN_SECRET: SECRET,
    APP_BASE_URL: 'https://weeklyfeedback.com',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function fakeSupabase(overrides: {
  createUser?: any;
  deleteUser?: jest.Mock;
  orgInsert?: any;
  updateUserById?: any;
  signInWithPassword?: any;
}): SupabaseService {
  const createUser = jest.fn().mockResolvedValue(overrides.createUser ?? { data: { user: { id: 'user-1' } }, error: null });
  const deleteUser = overrides.deleteUser ?? jest.fn().mockResolvedValue({ error: null });
  const updateUserById = jest.fn().mockResolvedValue(overrides.updateUserById ?? { error: null });
  const signInWithPassword = jest.fn().mockResolvedValue(
    overrides.signInWithPassword ?? {
      data: { session: { access_token: 'tok', expires_at: 9999999999 }, user: { email_confirmed_at: '2026-01-01' } },
      error: null,
    },
  );

  const orgInsertResult = overrides.orgInsert ?? { error: null };
  const from = jest.fn(() => ({
    insert: jest.fn().mockResolvedValue(orgInsertResult),
  }));

  return {
    db: {
      auth: { admin: { createUser, deleteUser, updateUserById } },
      from,
    },
    authClient: {
      auth: { signInWithPassword },
    },
  } as unknown as SupabaseService;
}

function fakeChannels(): { channels: ChannelsService; send: jest.Mock } {
  const send = jest.fn().mockResolvedValue(undefined);
  const channels = { get: () => ({ send }) } as unknown as ChannelsService;
  return { channels, send };
}

describe('AuthService — register', () => {
  it('crea el usuario sin confirmar el email y manda el link de verificación por email', async () => {
    const supabase = fakeSupabase({});
    const { channels, send } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await service.register({ email: 'a@b.com', password: 'password123', orgName: 'Acme' });

    expect((supabase.db.auth.admin.createUser as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', email_confirm: false }),
    );
    expect(send).toHaveBeenCalledWith('a@b.com', expect.stringContaining('https://weeklyfeedback.com/verify-email/'));
  });

  it('si falla crear la organización, borra el usuario de Auth huérfano', async () => {
    const supabase = fakeSupabase({ orgInsert: { error: new Error('boom') } });
    const { channels, send } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.register({ email: 'a@b.com', password: 'password123', orgName: 'Acme' })).rejects.toThrow('boom');

    expect(supabase.db.auth.admin.deleteUser).toHaveBeenCalledWith('user-1');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('AuthService — verifyEmail', () => {
  it('confirma el email del usuario que firma el token', async () => {
    const supabase = fakeSupabase({});
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);
    const token = signEmailVerificationToken('user-1', SECRET);

    await service.verifyEmail(token);

    expect(supabase.db.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { email_confirm: true });
  });

  it('rechaza un token con firma inválida', async () => {
    const supabase = fakeSupabase({});
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.verifyEmail('basura~invalida')).rejects.toThrow(NotFoundException);
    expect(supabase.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe('AuthService — login', () => {
  it('con email confirmado, devuelve la sesión', async () => {
    const supabase = fakeSupabase({});
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    const session = await service.login({ email: 'a@b.com', password: 'password123' });

    expect(session.accessToken).toBe('tok');
  });

  it('Supabase devuelve "Email not confirmed" — mensaje claro en vez de "credenciales incorrectas"', async () => {
    const supabase = fakeSupabase({
      signInWithPassword: { data: { session: null }, error: { message: 'Email not confirmed' } },
    });
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.login({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      /Confirma tu email/,
    );
  });

  it('cinturón y tirantes: sesión válida pero sin email_confirmed_at igual se rechaza', async () => {
    const supabase = fakeSupabase({
      signInWithPassword: {
        data: { session: { access_token: 'tok', expires_at: 9999999999 }, user: { email_confirmed_at: null } },
        error: null,
      },
    });
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.login({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(UnauthorizedException);
  });

  it('credenciales incorrectas de verdad, mensaje genérico', async () => {
    const supabase = fakeSupabase({
      signInWithPassword: { data: { session: null }, error: { message: 'Invalid login credentials' } },
    });
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('Email o contraseña incorrectos');
  });
});
