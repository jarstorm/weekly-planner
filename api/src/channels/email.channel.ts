import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, IncomingMessage } from './channel.interface';

@Injectable()
export class EmailChannel implements Channel {
  private readonly logger = new Logger(EmailChannel.name);

  constructor(private readonly config: ConfigService) {}

  // Local comparte la misma base de datos de Supabase que producción (ver
  // docs/despliegue-produccion.md) — sin esto, tener el backend corriendo
  // en local con `npm run start:dev` manda emails reales a contactos
  // reales cada vez que el cron encuentra un equipo dentro de su ventana.
  // APP_ENV=production solo está puesto en el .env del VPS (a propósito
  // distinto de NODE_ENV, que ahí sigue sin "production" hasta que haya
  // dominio+TLS, ver auth.controller.ts). Fuera de ese entorno: sin
  // EMAIL_DEV_OVERRIDE_TO no se manda nada (solo log), con ella se manda
  // igual pero SIEMPRE a esa dirección, nunca al contacto real.
  private resolveRecipient(contact: string): string | null {
    if (this.config.get<string>('APP_ENV') === 'production') return contact;

    const override = this.config.get<string>('EMAIL_DEV_OVERRIDE_TO');
    if (!override) {
      this.logger.warn(`Email a ${contact} NO enviado (entorno no productivo, sin EMAIL_DEV_OVERRIDE_TO configurado)`);
      return null;
    }
    return override;
  }

  // Resend limita a 10 req/s (visto en producción: una cuenta con muchos
  // destinatarios en el mismo tick de cron — recordatorio + encuesta —
  // dispara varios envíos casi simultáneos y algunos vuelven 429). Sin
  // reintento esos envíos se perdían en silencio (el caller solo logueaba
  // el error). 3 intentos con backoff, respetando Retry-After si Resend lo
  // manda.
  private async postToResend(apiKey: string, body: Record<string, unknown>): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) return;

      if (res.status === 429 && attempt < maxAttempts) {
        const retryAfterSeconds = Number(res.headers.get('Retry-After'));
        const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : attempt * 1000;
        this.logger.warn(`Resend devolvió 429, reintentando en ${delayMs}ms (intento ${attempt}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      const responseBody = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${responseBody}`);
    }
  }

  async send(contact: string, message: string): Promise<void> {
    const to = this.resolveRecipient(contact);
    if (!to) return;

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY / RESEND_FROM no configuradas');
    }

    const text = to === contact ? message : `[dev — destinatario real: ${contact}]\n\n${message}`;
    await this.postToResend(apiKey, { from, to: [to], subject: 'WeeklyFeedback', text });
  }

  async sendDocument(contact: string, file: Buffer, filename: string, caption: string): Promise<void> {
    const to = this.resolveRecipient(contact);
    if (!to) return;

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY / RESEND_FROM no configuradas');
    }

    const text = to === contact ? caption : `[dev — destinatario real: ${contact}]\n\n${caption}`;
    await this.postToResend(apiKey, {
      from,
      to: [to],
      subject: 'WeeklyFeedback',
      text,
      attachments: [{ filename, content: file.toString('base64') }],
    });
  }

  // Resend no da webhook de respuesta entrante en el MVP — la respuesta por
  // email se guarda vía el link con token de /checkin/<token> (sección 3.5)
  // o el endpoint manual (POST /api/checkins/manual).
  async parseIncoming(): Promise<IncomingMessage> {
    throw new Error('EmailChannel.parseIncoming no implementado — usar /checkin/<token> o POST /api/checkins/manual');
  }
}
