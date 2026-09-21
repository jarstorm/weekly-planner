import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { CheckinsService } from '../checkins/checkins.service';
import { signCheckinToken, verifyCheckinToken } from './token.util';
import { SubmitCheckinFormDto } from './dto/submit-checkin-form.dto';

export interface CheckinFormInfo {
  memberName: string;
  teamName: string;
  weekStart: string;
  alreadySubmitted: boolean;
}

@Injectable()
export class CheckinFormService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly checkins: CheckinsService,
  ) {}

  private secret(): string {
    const secret = this.config.get<string>('CHECKIN_TOKEN_SECRET');
    if (!secret) throw new Error('CHECKIN_TOKEN_SECRET no configurada');
    return secret;
  }

  buildLink(memberId: string, weekStart: string): string {
    const token = signCheckinToken({ memberId, weekStart }, this.secret());
    const base = this.config.get<string>('APP_BASE_URL') ?? '';
    return `${base}/checkin/${token}`;
  }

  private async resolveMember(token: string) {
    const decoded = verifyCheckinToken(token, this.secret());
    if (!decoded) throw new NotFoundException('Enlace inválido');

    const { data: member, error } = await this.supabase.db
      .from('members')
      .select('id, name, team_id, teams(name)')
      .eq('id', decoded.memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member) throw new NotFoundException('Enlace inválido');

    return { member, weekStart: decoded.weekStart };
  }

  async getForm(token: string): Promise<CheckinFormInfo> {
    const { member, weekStart } = await this.resolveMember(token);

    const { data: existing, error } = await this.supabase.db
      .from('checkins')
      .select('id')
      .eq('member_id', member.id)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error) throw error;

    return {
      memberName: member.name,
      teamName: (member as any).teams?.name ?? '',
      weekStart,
      alreadySubmitted: !!existing,
    };
  }

  async submit(dto: SubmitCheckinFormDto) {
    const { member, weekStart } = await this.resolveMember(dto.token);
    await this.checkins.saveInternal({
      team_id: member.team_id,
      member_id: member.id,
      week_start: weekStart,
      done_text: dto.doneText,
      next_text: dto.nextText,
      blocker_text: dto.blockerText,
    });
    return { ok: true };
  }
}
