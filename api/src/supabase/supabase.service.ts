import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.client = createClient(url, key);
    } else {
      this.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas — SupabaseService deshabilitado');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  get db(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase no configurado: falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
    }
    return this.client;
  }
}
