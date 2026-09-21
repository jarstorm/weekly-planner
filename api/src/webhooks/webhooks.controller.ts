import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from '../channels/channels.service';
import { CheckinsService } from '../checkins/checkins.service';
import { SupabaseService } from '../supabase/supabase.service';
import { currentWeekStart } from '../jobs/date.utils';

// Verificación + recepción de mensajes de WhatsApp Cloud API (Meta).
// El payload real se confirma en el prototipo n8n de la Fase 0
// (docs/especificaciones-tecnicas.md, sección 4, paso 0) — ajustar
// WhatsappChannel.parseIncoming si el formato difiere.
@Controller('webhooks/whatsapp')
export class WebhooksController {
  constructor(
    private readonly config: ConfigService,
    private readonly channels: ChannelsService,
    private readonly checkins: CheckinsService,
    private readonly supabase: SupabaseService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    throw new BadRequestException('Verify token inválido');
  }

  @Post()
  async receive(@Body() payload: unknown) {
    const { contact, rawText } = this.channels.get('whatsapp').parseIncoming(payload);

    const { data: member, error } = await this.supabase.db
      .from('members')
      .select('id, team_id, teams(timezone)')
      .eq('contact', contact)
      .eq('channel', 'whatsapp')
      .maybeSingle();
    if (error) throw error;
    if (!member) {
      // Número no reconocido — se ignora silenciosamente, no es un error del cliente.
      return { ok: true, matched: false };
    }

    const timezone = (member as any).teams?.timezone ?? 'Europe/Madrid';
    await this.checkins.saveInternal({
      team_id: member.team_id,
      member_id: member.id,
      week_start: currentWeekStart(new Date(), timezone),
      raw_text: rawText,
    });

    return { ok: true, matched: true };
  }
}
