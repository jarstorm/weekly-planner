import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, IncomingMessage } from './channel.interface';

@Injectable()
export class EmailChannel implements Channel {
  private readonly logger = new Logger(EmailChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(contact: string, message: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY / RESEND_FROM no configuradas');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [contact],
        subject: 'WeeklyFeedback',
        text: message,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${body}`);
    }
  }

  async sendDocument(contact: string, file: Buffer, filename: string, caption: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY / RESEND_FROM no configuradas');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [contact],
        subject: 'WeeklyFeedback',
        text: caption,
        attachments: [{ filename, content: file.toString('base64') }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${body}`);
    }
  }

  // Resend no da webhook de respuesta entrante en el MVP — la respuesta por
  // email se guarda vía el endpoint manual (POST /api/checkins/manual) hasta
  // que se monte parseo de email entrante (fuera del MVP).
  parseIncoming(): IncomingMessage {
    throw new Error('EmailChannel.parseIncoming no implementado en el MVP — usar POST /api/checkins/manual');
  }
}
