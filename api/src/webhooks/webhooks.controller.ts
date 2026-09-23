import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service';
import { CheckinsService } from '../checkins/checkins.service';
import { AudioService } from '../audio/audio.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChannelName, IncomingAudio } from '../channels/channel.interface';
import { currentWeekStart } from '../jobs/date.utils';

// parseIncoming rechaza un payload sin mensaje reconocible tirando un Error
// genérico — sin este wrapper, el filtro de excepciones por defecto de Nest
// lo convierte en 500 (bug real, detectado probando el webhook con un
// payload malformado a mano). Un payload que no reconocemos es un error del
// cliente (400), no un fallo nuestro.
async function parsePayloadOrBadRequest(channels: ChannelsService, channel: ChannelName, payload: unknown) {
  try {
    return await channels.get(channel).parseIncoming(payload);
  } catch (err) {
    throw new BadRequestException((err as Error).message);
  }
}

// Lógica compartida por los webhooks de entrada: resolver a qué member
// pertenece el mensaje (por contact + channel), transcribir si vino por
// nota de voz (sección 0.7), y guardar el checkin.
async function matchMemberAndSaveCheckin(
  supabase: SupabaseService,
  checkins: CheckinsService,
  audioService: AudioService,
  channel: ChannelName,
  contact: string,
  rawText: string,
  audio?: IncomingAudio,
) {
  const { data: member, error } = await supabase.db
    .from('members')
    .select('id, team_id, teams(organizations(timezone))')
    .eq('contact', contact)
    .eq('channel', channel)
    .maybeSingle();
  if (error) throw error;
  if (!member) {
    // Contacto no reconocido — se ignora silenciosamente, no es un error del cliente.
    return { ok: true, matched: false };
  }

  // Timezone de cuenta, no por equipo (migración 0006).
  const timezone = (member as any).teams?.organizations?.timezone ?? 'Europe/Madrid';
  const weekStart = currentWeekStart(new Date(), timezone);

  let finalText = rawText;
  let audioPath: string | undefined;
  if (audio) {
    audioPath = `${member.id}/${weekStart}.${audio.extension}`;
    // Se guarda el audio primero — si falla la transcripción, el audio
    // original no se pierde y se puede reintentar/revisar a mano.
    await audioService.store(audio.buffer, audioPath, audio.mimeType);
    finalText = await audioService.transcribe(audio.buffer, `checkin.${audio.extension}`, audio.mimeType);
  }

  await checkins.saveInternal({
    team_id: member.team_id,
    member_id: member.id,
    week_start: weekStart,
    raw_text: finalText,
    audio_path: audioPath,
  });

  return { ok: true, matched: true };
}

// Recepción de mensajes de Telegram (canal conversacional del MVP, ver
// docs/especificaciones-tecnicas.md sección 0.2 — WhatsApp queda fuera del
// MVP por decisión explícita, se retoma cuando haya demanda real).
// Sin paso de verificación GET: el alta del webhook se hace una vez,
// llamando a https://api.telegram.org/bot<TOKEN>/setWebhook?url=<esta URL>.
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly checkins: CheckinsService,
    private readonly audio: AudioService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post()
  async receive(@Body() payload: unknown) {
    const parsed = await parsePayloadOrBadRequest(this.channels, 'telegram', payload);
    return matchMemberAndSaveCheckin(this.supabase, this.checkins, this.audio, 'telegram', parsed.contact, parsed.rawText, parsed.audio);
  }
}
