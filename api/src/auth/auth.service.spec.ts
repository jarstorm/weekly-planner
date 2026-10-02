import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { AuthService } from './auth.service';
import { signEmailVerificationToken } from './verify-email-token.util';
import { signPasswordResetToken } from './password-reset-token.util';

const SECRET = 'test-secret';
const RESET_SECRET = 'test-reset-secret';

function fakeConfig(): ConfigService {
  const values: Record<string, string> = {
    EMAIL_VERIFICATION_TOKEN_SECRET: SECRET,
    PASSWORD_RESET_TOKEN_SECRET: RESET_SECRET,
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
  generateLink?: any;
  orgSelect?: any;
}): SupabaseService {
  const createUser = jest.fn().mockResolvedValue(overrides.createUser ?? { data: { user: { id: 'user-1' } }, error: null });
  const deleteUser = overrides.deleteUser ?? jest.fn().mockResolvedValue({ error: null });
  const updateUserById = jest.fn().mockResolvedValue(overrides.updateUserById ?? { error: null });
  const generateLink = jest
    .fn()
    .mockResolvedValue(overrides.generateLink ?? { data: { user: { id: 'user-1' } }, error: null });
  const signInWithPassword = jest.fn().mockResolvedValue(
    overrides.signInWithPassword ?? {
      data: { session: { access_token: 'tok', expires_at: 9999999999 }, user: { email_confirmed_at: '2026-01-01' } },
      error: null,
    },
  );

  const orgInsertResult = overrides.orgInsert ?? { error: null };
  const orgSelectResult = overrides.orgSelect ?? { data: { language: 'es' }, error: null };
  const orgInsert = jest.fn().mockResolvedValue(orgInsertResult);
  const from = jest.fn(() => ({
    insert: orgInsert,
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn().mockResolvedValue(orgSelectResult),
      })),
    })),
  }));

  return {
    db: {
      auth: { admin: { createUser, deleteUser, updateUserById, generateLink } },
      from,
    },
    authClient: {
      auth: { signInWithPassword },
    },
    _orgInsert: orgInsert,
  } as unknown as SupabaseService & { _orgInsert: jest.Mock };
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

  it('crea la organización con el límite de cortesía (Plan Equipo) y sin plan todavía elegido', async () => {
    // El plan real y sus límites los pone BillingService cuando completa
    // el primer Checkout (ver billing.service.spec.ts) — el registro ya no
    // acepta ni decide plan, solo deja la cuenta usable con el límite
    // mínimo mientras tanto. plan_selected no se manda explícito: el
    // default en false de la migración 0016 ya basta.
    const supabase = fakeSupabase({}) as any;
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await service.register({ email: 'a@b.com', password: 'password123', orgName: 'Acme' });

    expect(supabase._orgInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'equipo',
        status: 'trial',
        max_teams: 1,
        max_members_per_team: 10,
        history_retention_months: 1,
      }),
    );
    expect(supabase._orgInsert.mock.calls[0][0]).not.toHaveProperty('plan_selected');
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

describe('AuthService — requestPasswordReset', () => {
  it('si la cuenta existe, manda el link firmado por email en el idioma de la organización', async () => {
    const supabase = fakeSupabase({ orgSelect: { data: { language: 'en' }, error: null } });
    const { channels, send } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await service.requestPasswordReset('a@b.com');

    expect(supabase.db.auth.admin.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'a@b.com' });
    expect(send).toHaveBeenCalledWith('a@b.com', expect.stringContaining('https://weeklyfeedback.com/en/reset-password/'));
  });

  it('si la cuenta no existe, no manda nada ni revienta (evita filtrar qué emails están registrados)', async () => {
    const supabase = fakeSupabase({ generateLink: { data: { user: null }, error: { message: 'User not found' } } });
    const { channels, send } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.requestPasswordReset('nadie@b.com')).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('AuthService — resetPassword', () => {
  it('cambia la contraseña del usuario que firma el token', async () => {
    const supabase = fakeSupabase({});
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);
    const token = signPasswordResetToken('user-1', RESET_SECRET);

    await service.resetPassword(token, 'nueva-password-123');

    expect(supabase.db.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { password: 'nueva-password-123' });
  });

  it('rechaza un token con firma inválida', async () => {
    const supabase = fakeSupabase({});
    const { channels } = fakeChannels();
    const service = new AuthService(supabase, fakeConfig(), channels);

    await expect(service.resetPassword('basura~invalida', 'nueva-password-123')).rejects.toThrow(NotFoundException);
    expect(supabase.db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe('AuthService — resolveUser (usado por AuthGuard en cada request autenticado)', () => {
  function fakeSupabaseForResolveUser(overrides: { getUser?: any; org?: any }): SupabaseService {
    const getUser = jest.fn().mockResolvedValue(overrides.getUser ?? { data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null });
    const single = jest.fn().mockResolvedValue(overrides.org ?? { data: { id: 'org-1' }, error: null });
    const from = jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })) }));
    return { authClient: { auth: { getUser } }, db: { from } } as unknown as SupabaseService;
  }

  it('token válido con organización asociada: devuelve userId/email/organizationId', async () => {
    const supabase = fakeSupabaseForResolveUser({});
    const service = new AuthService(supabase, fakeConfig(), fakeChannels().channels);

    const result = await service.resolveUser('access-token-real');

    expect(result).toEqual({ userId: 'user-1', email: 'a@b.com', organizationId: 'org-1' });
  });

  it('token inválido o expirado: 401, sin llegar a consultar organizations', async () => {
    const supabase = fakeSupabaseForResolveUser({ getUser: { data: { user: null }, error: { message: 'invalid JWT' } } });
    const service = new AuthService(supabase, fakeConfig(), fakeChannels().channels);

    await expect(service.resolveUser('token-caducado')).rejects.toThrow(UnauthorizedException);
    expect(supabase.db.from).not.toHaveBeenCalled();
  });

  it('usuario válido pero sin organización asociada (fila huérfana): 401, no 500', async () => {
    const supabase = fakeSupabaseForResolveUser({ org: { data: null, error: null } });
    const service = new AuthService(supabase, fakeConfig(), fakeChannels().channels);

    await expect(service.resolveUser('access-token-real')).rejects.toThrow('Usuario sin organización asociada');
  });
});
