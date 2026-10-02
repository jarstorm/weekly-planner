import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService, AuthedUser } from './auth.service';
import { AuthGuard, SESSION_COOKIE } from './auth.guard';

function fakeAuth(resolveUser: jest.Mock): AuthService {
  return { resolveUser } as unknown as AuthService;
}

function contextWithRequest(req: any): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('AuthGuard — gatekeeper de todas las rutas protegidas', () => {
  it('sin cookie wf_session, rechaza con 401 sin llegar a resolveUser', async () => {
    const resolveUser = jest.fn();
    const guard = new AuthGuard(fakeAuth(resolveUser));
    const req: any = { cookies: {} };

    await expect(guard.canActivate(contextWithRequest(req))).rejects.toThrow(UnauthorizedException);
    expect(resolveUser).not.toHaveBeenCalled();
  });

  it('sin objeto cookies en absoluto (middleware de cookies no montado), también rechaza con 401, no con un TypeError', async () => {
    const resolveUser = jest.fn();
    const guard = new AuthGuard(fakeAuth(resolveUser));
    const req: any = {};

    await expect(guard.canActivate(contextWithRequest(req))).rejects.toThrow(UnauthorizedException);
  });

  it('con cookie, resuelve el usuario vía AuthService y lo cuelga en req.user', async () => {
    const user: AuthedUser = { userId: 'user-1', email: 'a@b.com', organizationId: 'org-1' };
    const resolveUser = jest.fn().mockResolvedValue(user);
    const guard = new AuthGuard(fakeAuth(resolveUser));
    const req: any = { cookies: { [SESSION_COOKIE]: 'token-real' } };

    const result = await guard.canActivate(contextWithRequest(req));

    expect(result).toBe(true);
    expect(resolveUser).toHaveBeenCalledWith('token-real');
    expect(req.user).toEqual(user);
  });

  it('un token de sesión inválido o expirado se propaga como 401 (AuthService.resolveUser ya lo lanza)', async () => {
    const resolveUser = jest.fn().mockRejectedValue(new UnauthorizedException('Sesión inválida o expirada'));
    const guard = new AuthGuard(fakeAuth(resolveUser));
    const req: any = { cookies: { [SESSION_COOKIE]: 'token-viejo' } };

    await expect(guard.canActivate(contextWithRequest(req))).rejects.toThrow('Sesión inválida o expirada');
    expect(req.user).toBeUndefined();
  });
});
