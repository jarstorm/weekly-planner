import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

const SELECT_FIELDS =
  'id, name, country, contact_name, reminder_dow, reminder_time, cutoff_time, timezone, plan, has_executive_summary, executive_summary_recipients, has_monthly_survey, survey_questions, survey_day_of_month';

@Injectable()
export class OrganizationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getOwn(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .select(SELECT_FIELDS)
      .eq('id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Organización no encontrada');
    return data;
  }

  async updateOwn(organizationId: string, dto: UpdateOrganizationDto) {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .update(dto)
      .eq('id', organizationId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return data;
  }
}
