import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
  constructor(private readonly supabase: SupabaseService) {}

  async register(dto: RegisterDto): Promise<Session> {
    // admin.createUser confirma el email directo — no hay flujo de
    // verificación por correo en el MVP.
    const { data: created, error: createError } = await this.supabase.db.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });
    if (createError) throw createError;

    const { error: orgError } = await this.supabase.db.from('organizations').insert({
      owner_id: created.user!.id,
      name: dto.orgName,
      plan: 'equipo',
      status: 'trial',
      max_teams: 1,
      max_members_per_team: 20,
    });
    if (orgError) {
      // Sin esto, un fallo acá deja un usuario de Auth huérfano (sin
      // organization) que ya no se puede volver a registrar — "email ya
      // registrado" en el próximo intento, sin ninguna cuenta usable detrás.
      await this.supabase.db.auth.admin.deleteUser(created.user!.id);
      throw orgError;
    }

    return this.login({ email: dto.email, password: dto.password });
  }

  async login(dto: LoginDto): Promise<Session> {
    const { data, error } = await this.supabase.authClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error || !data.session) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
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
