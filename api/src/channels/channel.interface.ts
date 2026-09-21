export interface IncomingMessage {
  contact: string;
  rawText: string;
}

export interface Channel {
  send(contact: string, message: string): Promise<void>;
  // Informe semanal: siempre se manda como PDF adjunto, en los tres canales
  // (decisión explícita — un PDF en el chat de WhatsApp/Telegram es tan
  // válido como en email, no solo texto plano). `caption` es el mensaje
  // corto que acompaña al adjunto, no el contenido completo del informe.
  sendDocument(contact: string, file: Buffer, filename: string, caption: string): Promise<void>;
  parseIncoming(payload: unknown): IncomingMessage;
}

export type ChannelName = 'email' | 'whatsapp' | 'telegram';
