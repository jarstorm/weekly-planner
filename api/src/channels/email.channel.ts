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

  async send(contact: string, message: string): Promise<void> {
    const to = this.resolveRecipient(contact);
    if (!to) return;

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY / RESEND_FROM no configuradas');
    }

    const text = to === contact ? message : `[dev — destinatario real: ${contact}]\n\n${message}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'WeeklyFeedback',
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${body}`);
    }
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
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'WeeklyFeedback',
        text,
        attachments: [{ filename, content: file.toString('base64') }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${body}`);
    }
  }

  // Resend no da webhook de respuesta entrante en el MVP — la respuesta por
  // email se guarda vía el link con token de /checkin/<token> (sección 3.5)
  // o el endpoint manual (POST /api/checkins/manual).
  async parseIncoming(): Promise<IncomingMessage> {
    throw new Error('EmailChannel.parseIncoming no implementado — usar /checkin/<token> o POST /api/checkins/manual');
  }
}
