import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CheckinInput {
  memberName: string;
  doneText: string | null;
  nextText: string | null;
  blockerText: string | null;
}

export interface AggregateInput {
  teamName: string;
  companyContext: string;
  checkins: CheckinInput[];
  membersWithoutResponse: string[];
  pastBlockers: string[];
}

@Injectable()
export class AggregateService {
  private readonly logger = new Logger(AggregateService.name);

  constructor(private readonly config: ConfigService) {}

  // Prompt tomado literalmente de docs/mvp-resumen-semanal-equipos.md, sección 10.
  private buildPrompt(input: AggregateInput): string {
    const respuestas = input.checkins
      .map(
        (c) =>
          `- ${c.memberName}: hecho: ${c.doneText ?? '(sin dato)'} | próximo: ${c.nextText ?? '(sin dato)'} | bloqueo: ${c.blockerText ?? '(ninguno)'}`,
      )
      .join('\n');

    return `Eres el asistente que redacta el resumen semanal del equipo "${input.teamName}".
Contexto de la empresa: ${input.companyContext}

Aquí tienes las respuestas individuales de esta semana:
${respuestas}

Redacta un informe semanal en español, con este formato exacto:
1. "Logros de la semana" — agrupa por proyecto o cliente cuando sea posible,
   no repitas literalmente cada respuesta, sintetiza.
2. "Bloqueos" — solo si hay alguno. Si un bloqueo ya apareció en semanas
   anteriores (te lo indico abajo), señálalo como recurrente.
3. "Próxima semana" — prioridades agrupadas por persona.
4. Si alguien no ha respondido, indícalo al final en una línea, sin dramatizar.

Tono: profesional pero cercano, como lo escribiría un jefe de equipo que
respeta el tiempo de quien lo lee. Máximo 200 palabras. Nada de relleno
genérico tipo "gran trabajo en equipo esta semana".

Sin respuesta esta semana: ${input.membersWithoutResponse.join(', ') || 'nadie, todos respondieron'}.

Bloqueos de semanas anteriores para detectar recurrencia:
${input.pastBlockers.join('\n') || '(ninguno registrado)'}`;
  }

  async generateReport(input: AggregateInput): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY no configurada');
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        messages: [{ role: 'user', content: this.buildPrompt(input) }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API respondió ${res.status}: ${body}`);
    }

    const json = await res.json();
    return json.content?.[0]?.text ?? '';
  }
}
