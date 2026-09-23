export interface IncomingAudio {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export interface IncomingMessage {
  contact: string;
  rawText: string;
  // Presente si el mensaje entrante es una nota de voz — sección 0.7. Si
  // viene seteado, rawText llega vacío: quien llama decide si transcribe
  // o no, parseIncoming solo resuelve "quién escribió y qué mandó".
  audio?: IncomingAudio;
  // Presente si el mensaje es un /start con parámetro (deep link de
  // vinculación de Telegram, ver webhooks.controller#linkMember) — el
  // member.id que hay que asociar a este contact.
  startParam?: string;
}

export interface Channel {
  send(contact: string, message: string): Promise<void>;
  // Informe semanal: siempre se manda como PDF adjunto, en los canales
  // conversacionales (decisión explícita — un PDF en el chat de Telegram es
  // tan válido como en email, no solo texto plano). `caption` es el mensaje
  // corto que acompaña al adjunto, no el contenido completo del informe.
  sendDocument(contact: string, file: Buffer, filename: string, caption: string): Promise<void>;
  // Async: bajar el archivo de una nota de voz (Telegram) implica una
  // llamada de red aparte antes de poder devolver el IncomingMessage.
  parseIncoming(payload: unknown): Promise<IncomingMessage>;
}

export type ChannelName = 'email' | 'telegram';
