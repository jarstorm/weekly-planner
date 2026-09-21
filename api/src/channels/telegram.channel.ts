import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, IncomingMessage } from './channel.interface';

// Canal temporal de MVP mientras se tramita la verificación de WhatsApp
// Business — mismo contrato Channel, así que se puede quitar sin tocar
// jobs/ ni el resto del negocio (ver docs/especificaciones-tecnicas.md,
// sección 0.2). `contact` acá es el chat_id numérico de Telegram, no un
// teléfono: solo se consigue después de que esa persona le escriba
// /start al bot (Telegram no permite iniciar conversación al revés).
@Injectable()
export class TelegramChannel implements Channel {
  private readonly logger = new Logger(TelegramChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(contact: string, message: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN no configurada');
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: contact, text: message }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram Bot API respondió ${res.status}: ${body}`);
    }
  }

  async sendDocument(contact: string, file: Buffer, filename: string, caption: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN no configurada');
    }

    const form = new FormData();
    form.append('chat_id', contact);
    form.append('caption', caption);
    form.append('document', new Blob([new Uint8Array(file)], { type: 'application/pdf' }), filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram Bot API respondió ${res.status}: ${body}`);
    }
  }

  parseIncoming(payload: any): IncomingMessage {
    const message = payload?.message;
    if (!message?.chat?.id) {
      throw new Error('Payload de Telegram sin mensaje entrante reconocible');
    }
    return {
      contact: String(message.chat.id),
      rawText: message.text ?? '',
    };
  }
}
