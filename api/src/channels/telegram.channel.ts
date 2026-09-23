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
  private cachedUsername: string | null | undefined;

  constructor(private readonly config: ConfigService) {}

  // Expuesto vía GET /api/telegram/bot-username (público, sin auth — el
  // @usuario de un bot ya es visible para cualquiera dentro de Telegram)
  // para que la página de ayuda pública pueda enlazar directo a t.me/<bot>
  // en vez de tener el nombre del bot hardcodeado o como placeholder entre
  // corchetes. Se cachea en memoria del proceso: el username de un bot no
  // cambia en caliente, no hace falta pedirlo a Telegram en cada visita.
  async getBotUsername(): Promise<string | null> {
    if (this.cachedUsername !== undefined) return this.cachedUsername;

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.cachedUsername = null;
      return null;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      if (!res.ok) throw new Error(`Telegram Bot API (getMe) respondió ${res.status}`);
      const { result } = (await res.json()) as { result?: { username?: string } };
      this.cachedUsername = result?.username ?? null;
      return this.cachedUsername;
    } catch (err) {
      // No se cachea el fallo — puede ser un corte transitorio de red, la
      // próxima visita a la página de ayuda lo reintenta solo.
      this.logger.error('No se pudo resolver el username del bot de Telegram', err as Error);
      return null;
    }
  }

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

  async parseIncoming(payload: any): Promise<IncomingMessage> {
    const message = payload?.message;
    if (!message?.chat?.id) {
      throw new Error('Payload de Telegram sin mensaje entrante reconocible');
    }
    const contact = String(message.chat.id);

    if (message.voice) {
      const audio = await this.downloadVoice(message.voice.file_id);
      return { contact, rawText: '', audio };
    }

    return { contact, rawText: message.text ?? '' };
  }

  // Telegram no manda el binario en el webhook, solo un file_id — hay que
  // pedir su ruta con getFile y después bajarlo de un host de archivos
  // aparte (api.telegram.org/file/..., no .../bot.../messages).
  private async downloadVoice(fileId: string) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurada');

    const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    if (!fileInfoRes.ok) {
      throw new Error(`Telegram Bot API (getFile) respondió ${fileInfoRes.status}: ${await fileInfoRes.text()}`);
    }
    const { result } = await fileInfoRes.json();
    const filePath: string = result.file_path;

    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!fileRes.ok) {
      throw new Error(`Telegram (descarga de archivo) respondió ${fileRes.status}`);
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const extension = filePath.split('.').pop() ?? 'oga';

    return { buffer, mimeType: 'audio/ogg', extension };
  }
}
