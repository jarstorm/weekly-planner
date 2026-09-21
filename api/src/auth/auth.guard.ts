import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

export const SESSION_COOKIE = 'wf_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      throw new UnauthorizedException('No hay sesión activa');
    }
    req.user = await this.auth.resolveUser(token);
    return true;
  }
}
