import { Response } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './auth.guard';
import { AuthController } from './auth.controller';

function fakeAuth(overrides: Partial<Record<keyof AuthService, jest.Mock>> = {}): AuthService {
  return {
    register: jest.fn().mockResolvedValue(undefined),
    verifyEmail: jest.fn().mockResolvedValue(undefined),
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue({ accessToken: 'tok-real', expiresAt: 1800000000 }),
    ...overrides,
  } as unknown as AuthService;
}

function fakeResponse(): Response {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
}

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

describe('AuthController.login — cookie de sesión', () => {
  it('pone wf_session httpOnly, sameSite=lax, con la expiración real de la sesión de Supabase', async () => {
    process.env.NODE_ENV = 'development';
    const auth = fakeAuth();
    const controller = new AuthController(auth);
    const res = fakeResponse();

    const result = await controller.login({ email: 'a@b.com', password: 'x' }, res);

    expect(result).toEqual({ ok: true });
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'tok-real', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      expires: new Date(1800000000 * 1000),
    });
  });

  it('secure=true solo en NODE_ENV=production — Secure en HTTP real rompería la cookie (bug ya visto en despliegue)', async () => {
    process.env.NODE_ENV = 'production';
    const auth = fakeAuth();
    const controller = new AuthController(auth);
    const res = fakeResponse();

    await controller.login({ email: 'a@b.com', password: 'x' }, res);

    const call = (res.cookie as jest.Mock).mock.calls[0];
    expect(call[2].secure).toBe(true);
  });

  it('en cualquier otro NODE_ENV (incluido undefined), secure=false', async () => {
    delete (process.env as any).NODE_ENV;
    const auth = fakeAuth();
    const controller = new AuthController(auth);
    const res = fakeResponse();

    await controller.login({ email: 'a@b.com', password: 'x' }, res);

    const call = (res.cookie as jest.Mock).mock.calls[0];
    expect(call[2].secure).toBe(false);
  });
});

describe('AuthController.logout', () => {
  it('limpia la cookie wf_session', () => {
    const controller = new AuthController(fakeAuth());
    const res = fakeResponse();

    const result = controller.logout(res);

    expect(result).toEqual({ ok: true });
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});

describe('AuthController — delegación simple', () => {
  it('register delega en AuthService y responde {ok:true} sin loguear al usuario', async () => {
    const auth = fakeAuth();
    const controller = new AuthController(auth);

    const result = await controller.register({ email: 'a@b.com', password: 'x', name: 'Ana' } as any);

    expect(auth.register).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('requestPasswordReset siempre devuelve {ok:true}, también si el email no existe (no filtra esa información)', async () => {
    const auth = fakeAuth({ requestPasswordReset: jest.fn().mockResolvedValue(undefined) } as any);
    const controller = new AuthController(auth);

    const result = await controller.requestPasswordReset({ email: 'no-existe@example.com' });

    expect(result).toEqual({ ok: true });
  });
});
