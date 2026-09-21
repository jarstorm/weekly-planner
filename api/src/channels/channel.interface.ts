export interface IncomingMessage {
  contact: string;
  rawText: string;
}

export interface Channel {
  send(contact: string, message: string): Promise<void>;
  parseIncoming(payload: unknown): IncomingMessage;
}

export type ChannelName = 'email' | 'whatsapp';
