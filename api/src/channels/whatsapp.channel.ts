import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, IncomingMessage } from './channel.interface';

@Injectable()
export class WhatsappChannel implements Channel {
  private readonly logger = new Logger(WhatsappChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(contact: string, message: string): Promise<void> {
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!phoneNumberId || !accessToken) {
      throw new Error('WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN no configuradas');
    }

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: contact,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WhatsApp Cloud API respondió ${res.status}: ${body}`);
    }
  }

  async sendDocument(contact: string, file: Buffer, filename: string, caption: string): Promise<void> {
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!phoneNumberId || !accessToken) {
      throw new Error('WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN no configuradas');
    }

    // La Cloud API de WhatsApp manda documentos en dos pasos: primero subir
    // el archivo como media (devuelve un media id), después referenciarlo
    // en el mensaje — no se puede mandar el binario directo en el mensaje.
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', new Blob([new Uint8Array(file)], { type: 'application/pdf' }), filename);

    const uploadRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      throw new Error(`WhatsApp Cloud API (upload media) respondió ${uploadRes.status}: ${body}`);
    }
    const { id: mediaId } = await uploadRes.json();

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: contact,
        type: 'document',
        document: { id: mediaId, filename, caption },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WhatsApp Cloud API respondió ${res.status}: ${body}`);
    }
  }

  // Payload real del webhook de Meta: se ajusta cuando se valide en el
  // prototipo n8n (Fase 0) — ver docs/notas-flujo-mensajeria.md.
  parseIncoming(payload: any): IncomingMessage {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) {
      throw new Error('Payload de WhatsApp sin mensaje entrante reconocible');
    }
    return {
      contact: message.from,
      rawText: message.text?.body ?? '',
    };
  }
}
