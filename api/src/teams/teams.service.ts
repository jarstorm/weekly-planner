import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateMemberDto } from './dto/create-member.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly supabase: SupabaseService) {}

  async createTeam(dto: CreateTeamDto) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async addMember(teamId: string, dto: CreateMemberDto) {
    const { data, error } = await this.supabase.db
      .from('members')
      .insert({ ...dto, team_id: teamId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listAll() {
    const { data, error } = await this.supabase.db.from('teams').select('*');
    if (error) throw error;
    return data;
  }

  async listMembers(teamId: string) {
    const { data, error } = await this.supabase.db
      .from('members')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true);
    if (error) throw error;
    return data;
  }
}
