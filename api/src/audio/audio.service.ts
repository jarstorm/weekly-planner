import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

const STORAGE_BUCKET = 'checkin-audio';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  // Whisper de Groq — mismo proveedor que AggregateService (sección 0.2),
  // sin alta nueva. Formato compatible con la API de transcripciones de
  // OpenAI (multipart, campo "file" + "model").
  async transcribe(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
    form.append('model', 'whisper-large-v3');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq Whisper respondió ${res.status}: ${body}`);
    }

    const json = await res.json();
    return (json.text ?? '').trim();
  }

  // Bucket privado — el audio no se sirve directo por URL pública, es
  // material del check-in de un empleado (sección 0.3: cualquier fichero
  // va a Supabase Storage, misma cuenta que DB/Auth). Guarda el path, no
  // una URL — quien lo necesite pide un signed URL bajo demanda.
  async store(buffer: Buffer, path: string, mimeType: string): Promise<string> {
    const { error } = await this.supabase.db.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: mimeType, upsert: true });
    if (error) throw error;
    return path;
  }

  // Un link temporal para reproducir un audio concreto desde el panel (vista
  // de detalle de un informe) — 1h de validez, de sobra para una sesión de
  // revisión, sin dejar el bucket accesible de forma permanente.
  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.db.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
}
