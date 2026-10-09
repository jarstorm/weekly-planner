import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberVerifyService } from '../member-verify/member-verify.service';
import { WhatsappChannel } from '../channels/whatsapp.channel';

// Nombre exacto de la plantilla de bienvenida aprobada en Meta (Marketing,
// una versión "es" y otra "en") — mismo criterio que
// ReminderJob.REMINDER_TEMPLATE_NAME.
const WELCOME_TEMPLATE_NAME = 'team_welcome_v1';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly memberVerify: MemberVerifyService,
    private readonly whatsapp: WhatsappChannel,
  ) {}

  // El backend siempre consulta con la service_role key (bypasea RLS), así
  // que la autorización "solo tus propios equipos" se hace acá, no en la
  // base de datos — ver docs/especificaciones-tecnicas.md, sección 0.1.
  private async assertOwnership(teamId: string, organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('id, organization_id')
      .eq('id', teamId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Equipo no encontrado');
    if (data.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }
  }

  // Roadmap paso 14: límites de plan. max_teams/max_members_per_team en
  // NULL significa sin límite (solo Plan Custom) — ver
  // docs/mvp-resumen-semanal-equipos.md, sección 11.
  private async assertTeamLimit(organizationId: string) {
    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('max_teams')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;
    if (org.max_teams === null) return;

    const { count, error: countError } = await this.supabase.db
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    if (countError) throw countError;

    if ((count ?? 0) >= org.max_teams) {
      throw new ForbiddenException(
        `Tu plan permite hasta ${org.max_teams} equipo(s) — actualiza de plan para crear más.`,
      );
    }
  }

  private async assertMemberLimit(teamId: string, organizationId: string) {
    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('max_members_per_team')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;
    if (org.max_members_per_team === null) return;

    const { count, error: countError } = await this.supabase.db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('active', true);
    if (countError) throw countError;

    if ((count ?? 0) >= org.max_members_per_team) {
      throw new ForbiddenException(
        `Tu plan permite hasta ${org.max_members_per_team} miembro(s) por equipo — actualiza de plan para añadir más.`,
      );
    }
  }

  async createTeam(organizationId: string, dto: CreateTeamDto) {
    await this.assertTeamLimit(organizationId);
    const { data, error } = await this.supabase.db
      .from('teams')
      .insert({ ...dto, organization_id: organizationId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listOwn(organizationId: string) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return data;
  }

  async getOwn(organizationId: string, teamId: string) {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Equipo no encontrado');
    if (data.organization_id !== organizationId) {
      throw new ForbiddenException('Este equipo no pertenece a tu organización');
    }
    return data;
  }

  async updateTeam(organizationId: string, teamId: string, dto: UpdateTeamDto) {
    await this.assertOwnership(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('teams')
      .update(dto)
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async addMember(organizationId: string, teamId: string, dto: CreateMemberDto) {
    await this.assertOwnership(teamId, organizationId);
    await this.assertMemberLimit(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .insert({ ...dto, team_id: teamId })
      .select()
      .single();
    // 23505 contra members_active_contact_per_channel (migración 0017): ya
    // hay otro miembro activo (de este equipo o de cualquier otro) con el
    // mismo contacto por whatsapp/telegram — el matching del webhook
    // entrante es por (contact, channel), no puede haber dos a la vez.
    if (error?.code === '23505') {
      throw new ConflictException('Ya hay otro miembro activo con ese mismo contacto');
    }
    if (error) throw error;
    // Solo por email tiene sentido "verificar". Telegram ni tiene contact
    // todavía en este punto (se rellena solo cuando abre el bot), así que
    // no hay a quién mandarle nada. WhatsApp sí trae el número desde el
    // alta, y con la plantilla de bienvenida aprobada por Meta ya se le
    // puede escribir sin que haya hablado antes (business-initiated).
    if (data.channel === 'email') {
      await this.memberVerify.sendVerificationEmail(data.id, data.name, data.contact, teamId);
    } else if (data.channel === 'whatsapp') {
      // No bloquea el alta del miembro si falla (p.ej. la plantilla de
      // bienvenida sigue en revisión en Meta) — a diferencia del email de
      // verificación, esto es solo un aviso de cortesía, no un paso
      // necesario del flujo.
      try {
        await this.sendWhatsappWelcome(data.name, data.contact, teamId);
      } catch (err) {
        this.logger.error(`Fallo mandando bienvenida de WhatsApp a ${data.contact}`, err as Error);
      }
    }
    return data;
  }

  private async sendWhatsappWelcome(memberName: string, contact: string, teamId: string): Promise<void> {
    const { data: team, error } = await this.supabase.db
      .from('teams')
      .select('name, organizations(language)')
      .eq('id', teamId)
      .single();
    if (error) throw error;

    const language = (team as any).organizations?.language ?? 'es';
    await this.whatsapp.sendTemplate(contact, WELCOME_TEMPLATE_NAME, language, [memberName, team.name]);
  }

  // El miembro tiene que ser de ESE equipo Y ese equipo de la organización
  // del que llama — dos saltos, no uno, para no poder editar/borrar un
  // miembro pasándole el team_id de un equipo propio pero el member_id de
  // uno ajeno.
  private async assertMemberOwnership(teamId: string, memberId: string, organizationId: string) {
    await this.assertOwnership(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .select('id, team_id')
      .eq('id', memberId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.team_id !== teamId) {
      throw new NotFoundException('Miembro no encontrado');
    }
  }

  async updateMember(organizationId: string, teamId: string, memberId: string, dto: UpdateMemberDto) {
    await this.assertMemberOwnership(teamId, memberId, organizationId);
    // Reactivar a alguien desactivado cuenta contra el límite del plan
    // igual que dar de alta uno nuevo — sin este chequeo, borrar y
    // reactivar sería una forma de saltarse max_members_per_team.
    if (dto.active === true) {
      await this.assertMemberLimit(teamId, organizationId);
    }
    // Mover de equipo: el equipo de destino tiene que ser de la misma
    // organización (assertOwnership ya lo comprueba) y respetar su propio
    // max_members_per_team — sin este chequeo, mover sería una forma de
    // saltarse el límite del plan en el equipo de destino.
    if (dto.team_id && dto.team_id !== teamId) {
      await this.assertOwnership(dto.team_id, organizationId);
      await this.assertMemberLimit(dto.team_id, organizationId);
    }
    const { data, error } = await this.supabase.db
      .from('members')
      .update(dto)
      .eq('id', memberId)
      .select()
      .single();
    // Mismo caso que addMember (migración 0017): reactivar o cambiar el
    // contacto/canal de este miembro choca con otro miembro ya activo con
    // ese mismo contacto.
    if (error?.code === '23505') {
      throw new ConflictException('Ya hay otro miembro activo con ese mismo contacto');
    }
    if (error) throw error;
    return data;
  }

  // Reenvío manual desde el panel — mismo email que al dar de alta, para
  // cuando el original no llegó (spam, dirección mal escrita y corregida
  // después, etc.). No pide que el miembro esté sin verificar todavía:
  // reenviar a alguien ya verificado es inofensivo (verify() es idempotente).
  async resendMemberVerification(organizationId: string, teamId: string, memberId: string) {
    await this.assertMemberOwnership(teamId, memberId, organizationId);
    const { data: member, error } = await this.supabase.db
      .from('members')
      .select('id, name, contact, channel')
      .eq('id', memberId)
      .single();
    if (error) throw error;
    if (member.channel !== 'email') {
      throw new ForbiddenException('Solo los miembros con canal email tienen verificación');
    }
    await this.memberVerify.sendVerificationEmail(member.id, member.name, member.contact, teamId);
    return { ok: true };
  }

  // Soft delete (active=false) — no un DELETE de la fila. El historial de
  // checkins/informes ya generados sigue referenciando a este miembro por
  // nombre; borrarlo de verdad no aporta nada y solo complica los reportes
  // pasados. `listMembers`/`statusForTeamWeek` ya filtran por active=true.
  async removeMember(organizationId: string, teamId: string, memberId: string) {
    await this.assertMemberOwnership(teamId, memberId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .update({ active: false })
      .eq('id', memberId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listMembersForOwner(organizationId: string, teamId: string) {
    await this.assertOwnership(teamId, organizationId);
    const { data, error } = await this.supabase.db
      .from('members')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true);
    if (error) throw error;
    return data;
  }

  // Sin scoping por organización — solo lo usan los jobs internos (cron),
  // nunca un endpoint expuesto al front. Trae el horario de la
  // organización (migración 0006: config de cuenta, no por equipo) y la
  // config del resumen ejecutivo (migración 0009) y lo aplana sobre el
  // equipo, así ReminderJob/ReportJob no tienen que saber de dónde sale
  // cada campo. `report_recipients` ya viene del `*` de teams.
  //
  // Excluye equipos de organizaciones con status='canceled' (baja o impago
  // — BillingService.handleEvent ya pone ese status vía webhook de Stripe,
  // ver billing.service.ts) para que ReminderJob/ReportJob dejen de mandar
  // en cuanto se cancela, sin que cada job tenga que comprobarlo por su
  // cuenta. 'trial' sigue mandando a propósito, solo 'canceled' frena.
  async listAll() {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select(
        '*, organizations(status, reminder_dow, reminder_time, cutoff_time, timezone, language, has_executive_summary, executive_summary_recipients)',
      );
    if (error) throw error;
    return (data ?? [])
      .filter((t: any) => t.organizations.status !== 'canceled')
      .map((t: any) => {
        const { organizations: org, ...team } = t;
        return {
          ...team,
          reminder_dow: org.reminder_dow,
          reminder_time: org.reminder_time,
          cutoff_time: org.cutoff_time,
          timezone: org.timezone,
          language: org.language,
          has_executive_summary: org.has_executive_summary,
          executive_summary_recipients: org.executive_summary_recipients,
        };
      });
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
