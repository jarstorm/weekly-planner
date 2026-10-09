import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { welcomeVerifyEmailMessage, passwordResetMessage, localePrefix, AccountLanguage } from '../account-language';
import { signEmailVerificationToken, verifyEmailVerificationToken } from './verify-email-token.util';
import { signPasswordResetToken, verifyPasswordResetToken } from './password-reset-token.util';

export interface Session {
  accessToken: string;
  expiresAt: number; // epoch seconds
}

export interface AuthedUser {
  userId: string;
  email: string;
  organizationId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly channels: ChannelsService,
  ) {}

  private verifyTokenSecret(): string {
    const secret = this.config.get<string>('EMAIL_VERIFICATION_TOKEN_SECRET');
    if (!secret) throw new Error('EMAIL_VERIFICATION_TOKEN_SECRET no configurada');
    return secret;
  }

  private passwordResetTokenSecret(): string {
    const secret = this.config.get<string>('PASSWORD_RESET_TOKEN_SECRET');
    if (!secret) throw new Error('PASSWORD_RESET_TOKEN_SECRET no configurada');
    return secret;
  }

  // No confirma el email al crear el usuario (antes sí, email_confirm:
  // true, "no hay flujo de verificación en el MVP") — ahora hace falta
  // confirmarlo por el link del email de bienvenida antes de poder entrar:
  // Supabase Auth ya rechaza signInWithPassword para un email sin
  // confirmar por su cuenta, así que login() no necesita duplicar ese
  // chequeo, solo traducir el mensaje de error (ver login() más abajo).
  async register(dto: RegisterDto): Promise<void> {
    const { data: created, error: createError } = await this.supabase.db.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: false,
    });
    if (createError) throw createError;

    // Límite de cortesía mínimo (igual que Plan Equipo) hasta que elija
    // plan y pase por Stripe — plan_selected en false por defecto fuerza
    // pasar por /app/billing en el primer login (ver AppShell). El plan
    // real y sus límites los pone BillingService.handleEvent cuando
    // completa el Checkout, nunca aquí.
    const { error: orgError } = await this.supabase.db.from('organizations').insert({
      owner_id: created.user!.id,
      name: dto.orgName,
      plan: 'equipo',
      status: 'trial',
      max_teams: 1,
      max_members_per_team: 10,
      history_retention_months: 1,
    });
    if (orgError) {
      // Sin esto, un fallo acá deja un usuario de Auth huérfano (sin
      // organization) que ya no se puede volver a registrar — "email ya
      // registrado" en el próximo intento, sin ninguna cuenta usable detrás.
      await this.supabase.db.auth.admin.deleteUser(created.user!.id);
      throw orgError;
    }

    const token = signEmailVerificationToken(created.user!.id, this.verifyTokenSecret());
    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? '';
    // Idioma 'es' fijo aquí: organizations.language todavía no lo elige
    // nadie en el registro (se ajusta después desde /app/feedback), así
    // que no hay nada más específico que consultar en este momento.
    const link = `${baseUrl}${localePrefix('es')}/verify-email/${token}`;
    await this.channels.get('email').send(dto.email, welcomeVerifyEmailMessage('es', dto.orgName, link));

    await this.notifyAdminOfNewSignup(dto.orgName, dto.email);
  }

  // Aviso a Javi de cada registro nuevo (trial, antes de verificar email o
  // pagar — el aviso de "cliente de pago" es otro evento distinto, ver
  // BillingService.handleEvent/checkout.session.completed). Nunca debe
  // tumbar el registro: si Resend falla o falta la env var, se loguea y
  // se sigue, la persona ya tiene su cuenta creada igual.
  private async notifyAdminOfNewSignup(orgName: string, email: string): Promise<void> {
    const adminEmail = this.config.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (!adminEmail) {
      this.logger.warn('ADMIN_NOTIFICATION_EMAIL no configurada, aviso de nuevo registro no mandado');
      return;
    }
    try {
      await this.channels
        .get('email')
        .send(adminEmail, `Nuevo registro en WeeklyFeedback 🎉\n\nOrganización: ${orgName}\nEmail: ${email}`);
    } catch (err) {
      this.logger.error('Fallo mandando el aviso de nuevo registro al admin', err as Error);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = verifyEmailVerificationToken(token, this.verifyTokenSecret());
    if (!payload) throw new NotFoundException('Enlace de verificación inválido o caducado');

    // Idempotente a propósito — no hay problema en que alguien haga clic
    // en el link dos veces, ni tabla de "usado" que mantener por eso.
    const { error } = await this.supabase.db.auth.admin.updateUserById(payload.userId, { email_confirm: true });
    if (error) throw error;
  }

  // Respuesta idéntica exista o no la cuenta (evita que alguien use este
  // endpoint para averiguar qué emails están registrados) — el caller
  // (controller) siempre devuelve { ok: true } sin mirar el resultado de
  // esto. generateLink con type "recovery" hace la búsqueda por email y
  // falla si no existe, sin mandar ningún correo por su cuenta — el envío
  // real va por nuestro canal de email (Resend), con nuestro propio token
  // firmado, igual que el resto de links de la app.
  async requestPasswordReset(email: string): Promise<void> {
    const { data, error } = await this.supabase.db.auth.admin.generateLink({ type: 'recovery', email });
    if (error || !data.user) return;

    const { data: org } = await this.supabase.db
      .from('organizations')
      .select('language')
      .eq('owner_id', data.user.id)
      .maybeSingle();
    const language: AccountLanguage = (org?.language as AccountLanguage) ?? 'es';

    const token = signPasswordResetToken(data.user.id, this.passwordResetTokenSecret());
    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? '';
    const link = `${baseUrl}${localePrefix(language)}/reset-password/${token}`;
    await this.channels.get('email').send(email, passwordResetMessage(language, link));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const payload = verifyPasswordResetToken(token, this.passwordResetTokenSecret());
    if (!payload) throw new NotFoundException('Enlace de restablecimiento inválido o caducado');

    const { error } = await this.supabase.db.auth.admin.updateUserById(payload.userId, { password: newPassword });
    if (error) throw error;
  }

  async login(dto: LoginDto): Promise<Session> {
    const { data, error } = await this.supabase.authClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error) {
      // Supabase ya bloquea el login de un email sin confirmar por su
      // cuenta (GoTrue devuelve exactamente este mensaje) — solo hace
      // falta traducirlo a algo más claro que "credenciales incorrectas".
      if (error.message === 'Email not confirmed') {
        throw new UnauthorizedException('Confirma tu email antes de entrar — revisa el correo de bienvenida.');
      }
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    if (!data.session) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    // Cinturón y tirantes — Supabase ya debería haber cortado esto arriba
    // (proyecto configurado para exigir email confirmado), pero si esa
    // opción de plataforma cambiara alguna vez, aquí no dependemos de ella.
    if (!data.user?.email_confirmed_at) {
      throw new UnauthorizedException('Confirma tu email antes de entrar — revisa el correo de bienvenida.');
    }
    return {
      accessToken: data.session.access_token,
      expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async resolveUser(accessToken: string): Promise<AuthedUser> {
    const { data, error } = await this.supabase.authClient.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('id')
      .eq('owner_id', data.user.id)
      .single();
    if (orgError || !org) {
      throw new UnauthorizedException('Usuario sin organización asociada');
    }

    return { userId: data.user.id, email: data.user.email!, organizationId: org.id };
  }
}
