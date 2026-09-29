import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { memberVerifyEmailMessage, localePrefix, AccountLanguage } from '../account-language';
import { signMemberVerifyToken, verifyMemberVerifyToken } from './member-verify-token.util';

@Injectable()
export class MemberVerifyService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly channels: ChannelsService,
  ) {}

  private secret(): string {
    const secret = this.config.get<string>('MEMBER_VERIFY_TOKEN_SECRET');
    if (!secret) throw new Error('MEMBER_VERIFY_TOKEN_SECRET no configurada');
    return secret;
  }

  // Usado tanto al dar de alta un miembro por email (TeamsService.addMember)
  // como al reenviar a mano desde el panel (TeamsService.resendMemberVerification)
  // — mismo email las dos veces, no hay diferencia entre "primer envío" y
  // "reenvío".
  async sendVerificationEmail(memberId: string, memberName: string, contact: string, teamId: string): Promise<void> {
    const { data: team, error } = await this.supabase.db
      .from('teams')
      .select('name, organizations(name, language)')
      .eq('id', teamId)
      .single();
    if (error) throw error;

    const org = (team as any).organizations;
    const language: AccountLanguage = org?.language ?? 'es';
    const token = signMemberVerifyToken(memberId, this.secret());
    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? '';
    const link = `${baseUrl}${localePrefix(language)}/verify-member-email/${token}`;

    await this.channels.get('email').send(contact, memberVerifyEmailMessage(language, memberName, team.name, link));
  }

  // Idempotente a propósito, igual que AuthService.verifyEmail — no pasa
  // nada si alguien hace clic en el link dos veces.
  async verify(token: string): Promise<void> {
    const payload = verifyMemberVerifyToken(token, this.secret());
    if (!payload) throw new NotFoundException('Enlace de verificación inválido o caducado');

    const { error } = await this.supabase.db
      .from('members')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('id', payload.memberId);
    if (error) throw error;
  }
}
