import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from '../channels/channels.service';
import { CheckinsService } from '../checkins/checkins.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelName } from '../channels/channel.interface';
import { currentWeekStart } from '../jobs/date.utils';

// Lógica compartida por los webhooks de entrada: resolver a qué member
// pertenece el mensaje (por contact + channel) y guardar el checkin.
// Cada canal tiene su propio controller porque cada uno verifica su
// webhook distinto (Meta con hub.challenge, Telegram sin verificación
// previa — el alta se hace llamando a setWebhook una vez, ver sección 0.2
// de docs/especificaciones-tecnicas.md).
async function matchMemberAndSaveCheckin(
  supabase: SupabaseService,
  checkins: CheckinsService,
  channel: ChannelName,
  contact: string,
  rawText: string,
) {
  const { data: member, error } = await supabase.db
    .from('members')
    .select('id, team_id, teams(timezone)')
    .eq('contact', contact)
    .eq('channel', channel)
    .maybeSingle();
  if (error) throw error;
  if (!member) {
    // Contacto no reconocido — se ignora silenciosamente, no es un error del cliente.
    return { ok: true, matched: false };
  }

  const timezone = (member as any).teams?.timezone ?? 'Europe/Madrid';
  await checkins.saveInternal({
    team_id: member.team_id,
    member_id: member.id,
    week_start: currentWeekStart(new Date(), timezone),
    raw_text: rawText,
  });

  return { ok: true, matched: true };
}

// Verificación + recepción de mensajes de WhatsApp Cloud API (Meta).
// El payload real se confirma en el prototipo n8n de la Fase 0
// (docs/especificaciones-tecnicas.md, sección 4, paso 0) — ajustar
// WhatsappChannel.parseIncoming si el formato difiere.
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
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
    return matchMemberAndSaveCheckin(this.supabase, this.checkins, 'whatsapp', contact, rawText);
  }
}

// Recepción de mensajes de Telegram (canal temporal de MVP, sección 0.2).
// Sin paso de verificación GET: el alta del webhook se hace una vez,
// llamando a https://api.telegram.org/bot<TOKEN>/setWebhook?url=<esta URL>.
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly checkins: CheckinsService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post()
  async receive(@Body() payload: unknown) {
    const { contact, rawText } = this.channels.get('telegram').parseIncoming(payload);
    return matchMemberAndSaveCheckin(this.supabase, this.checkins, 'telegram', contact, rawText);
  }
}
