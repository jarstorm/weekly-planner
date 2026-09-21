import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Injectable()
export class CheckinsService {
  constructor(private readonly supabase: SupabaseService) {}

  async saveManual(dto: CreateCheckinDto) {
    const { data, error } = await this.supabase.db
      .from('checkins')
      .upsert(dto, { onConflict: 'member_id,week_start' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listForTeamWeek(teamId: string, weekStart: string) {
    const { data, error } = await this.supabase.db
      .from('checkins')
      .select('*, members(name)')
      .eq('team_id', teamId)
      .eq('week_start', weekStart);
    if (error) throw error;
    return data;
  }
}
