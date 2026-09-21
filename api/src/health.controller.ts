import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async check() {
    return { ok: true, supabaseConfigured: this.supabase.isConfigured() };
  }
}
