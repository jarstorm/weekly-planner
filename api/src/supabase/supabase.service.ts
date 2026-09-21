import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;
  private authClientInstance: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');

    if (url && serviceKey) {
      this.client = createClient(url, serviceKey);
    } else {
      this.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas — SupabaseService deshabilitado');
    }

    // Cliente separado con la anon key, solo para las llamadas de Auth
    // (signUp/signInWithPassword/getUser) — así el módulo de auth no
    // necesita el service_role para lo que la propia API de Supabase Auth
    // ya resuelve con la anon key. Nunca llega al frontend (ver
    // docs/especificaciones-tecnicas.md, sección 0.1).
    if (url && anonKey) {
      this.authClientInstance = createClient(url, anonKey);
    } else {
      this.logger.warn('SUPABASE_ANON_KEY no configurada — auth de Supabase deshabilitada');
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

  get authClient(): SupabaseClient {
    if (!this.authClientInstance) {
      throw new Error('Supabase auth no configurado: falta SUPABASE_URL / SUPABASE_ANON_KEY en .env');
    }
    return this.authClientInstance;
  }
}
