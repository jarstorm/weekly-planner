import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getOwn(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .select('id, name, country, contact_name')
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
      .select('id, name, country, contact_name')
      .single();
    if (error) throw error;
    return data;
  }
}
