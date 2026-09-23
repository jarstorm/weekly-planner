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

export interface TeamReportInput {
  teamName: string;
  contentMarkdown: string;
}

export interface ExecutiveSummaryInput {
  organizationName: string;
  teamReports: TeamReportInput[];
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

  // Segunda llamada a la IA, con los informes de equipo YA GENERADOS (no
  // los checkins en bruto) como entrada — más barata todavía que la
  // primera agregación, el texto de partida ya viene resumido (sección 6.4
  // del doc de producto). Literal del ejemplo de esa sección.
  private buildExecutiveSummaryPrompt(input: ExecutiveSummaryInput): string {
    const informes = input.teamReports
      .map((t) => `--- ${t.teamName} ---\n${t.contentMarkdown}`)
      .join('\n\n');

    return `Eres el asistente que redacta el resumen ejecutivo semanal de la empresa "${input.organizationName}", a partir de los informes ya generados de cada uno de sus equipos esta semana.

Informes de esta semana, por equipo:
${informes}

Redacta un resumen ejecutivo en español, con este formato exacto:
1. Un titular de una línea por equipo — qué es lo más relevante de su semana.
2. "Riesgo que cruza equipos" — solo si detectas un bloqueo o dependencia que afecta a más de un equipo. Si no hay ninguno, omite esta sección entera.
3. "Lo más urgente esta semana" — 2-3 cosas a nivel empresa.

Tono: profesional, directo, para quien dirige la empresa y no tiene tiempo de leer cada informe de equipo por separado. Máximo 150 palabras. No repitas el detalle que ya está en el informe de cada equipo — sintetiza a nivel empresa, no reformules cada línea.`;
  }

  // Groq en vez de la API de Claude — temporal de MVP mientras la cuenta de
  // Anthropic no está disponible (ver docs/especificaciones-tecnicas.md,
  // sección 0.2). Endpoint compatible con el formato de OpenAI; cuando haya
  // API key de Anthropic, esto vuelve a la llamada a api.anthropic.com sin
  // tocar el resto del servicio (buildPrompt/buildExecutiveSummaryPrompt no cambian).
  private async callGroq(prompt: string): Promise<string> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    const model = this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
    if (!apiKey) {
      throw new Error('GROQ_API_KEY no configurada');
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq API respondió ${res.status}: ${body}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
  }

  async generateReport(input: AggregateInput): Promise<string> {
    return this.callGroq(this.buildPrompt(input));
  }

  async generateExecutiveSummary(input: ExecutiveSummaryInput): Promise<string> {
    return this.callGroq(this.buildExecutiveSummaryPrompt(input));
  }
}
