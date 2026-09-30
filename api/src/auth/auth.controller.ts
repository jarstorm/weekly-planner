import { Body, Controller, Post, Res, UseGuards, Get } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard, SESSION_COOKIE } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthedUser } from './auth.service';

// El front nunca ve el token de Supabase: se guarda en una cookie httpOnly
// propia (wf_session) que el navegador manda solo, sin JS de por medio.
// Ver docs/especificaciones-tecnicas.md, sección 0.1.
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Ya no loguea al usuario — antes de este cambio devolvía sesión y
  // ponía la cookie directo; ahora la cuenta queda creada pero sin
  // confirmar hasta que el usuario haga clic en el link del email de
  // bienvenida (AuthService.verifyEmail), así que aquí no hay nada que
  // loguear todavía.
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.auth.register(dto);
    return { ok: true };
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  // Siempre { ok: true }, exista o no la cuenta — ver
  // AuthService.requestPasswordReset, que ya hace el trabajo de no filtrar
  // esa información.
  @Post('request-password-reset')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto);
    this.setSessionCookie(res, session.accessToken, session.expiresAt);
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthedUser) {
    return user;
  }

  private setSessionCookie(res: Response, token: string, expiresAt: number) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(expiresAt * 1000),
    });
  }
}
