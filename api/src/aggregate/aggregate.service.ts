import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CheckinInput {
  memberName: string;
  doneText: string | null;
  nextText: string | null;
  blockerText: string | null;
}

export type ReportLanguage = 'es' | 'en';

export interface AggregateInput {
  teamName: string;
  companyContext: string;
  checkins: CheckinInput[];
  membersWithoutResponse: string[];
  pastBlockers: string[];
  // Idioma de la cuenta (organizations.language, migración 0012) — 'es' si
  // se omite, mismo comportamiento que antes de que existiera el campo.
  language?: ReportLanguage;
}

export interface TeamReportInput {
  teamName: string;
  contentMarkdown: string;
}

export interface ExecutiveSummaryInput {
  organizationName: string;
  teamReports: TeamReportInput[];
  language?: ReportLanguage;
}

@Injectable()
export class AggregateService {
  private readonly logger = new Logger(AggregateService.name);

  constructor(private readonly config: ConfigService) {}

  // Prompt tomado literalmente de docs/mvp-resumen-semanal-equipos.md, sección 10.
  // Variante en inglés para cuentas con organizations.language = 'en'
  // (migración 0012) — misma estructura y tono, no una traducción literal
  // palabra por palabra (para que el modelo escriba en inglés natural).
  private buildPrompt(input: AggregateInput): string {
    const language = input.language ?? 'es';

    if (language === 'en') {
      const responses = input.checkins
        .map(
          (c) =>
            `- ${c.memberName}: done: ${c.doneText ?? '(no data)'} | next: ${c.nextText ?? '(no data)'} | blocker: ${c.blockerText ?? '(none)'}`,
        )
        .join('\n');

      return `You are the assistant writing the weekly summary for the "${input.teamName}" team.
Company context: ${input.companyContext}

Here are this week's individual replies:
${responses}

Write a weekly report in English, with this exact format:
1. "This week's wins" — group by project or client where possible, don't
   just repeat each reply verbatim, synthesize.
2. "Blockers" — only if there are any. If a blocker already showed up in
   previous weeks (listed below), flag it as recurring.
3. "Next week" — priorities grouped by person.
4. If someone hasn't replied, mention it at the end in one line, no drama.

Tone: professional but approachable, like a team lead who respects the
reader's time. Aim for 2-3 pages, around 900 words — go into real detail per
project/person rather than padding with filler, and expand each blocker or
recurring issue with its context and impact. No generic filler like "great
teamwork this week".

Never invent facts, tools, tickets, systems, metrics, or names that the
person didn't mention — no made-up compliance reviews, ticket numbers,
specific tools (Jira, SharePoint, GitHub Actions...) or numbers unless they
actually appear in the replies below. If a reply is short or vague, keep
that part of the report short too: it's better to be honest and brief than
to pad with invented specifics. The word target is secondary — accuracy to
what was actually said matters far more than hitting it.

No response this week: ${input.membersWithoutResponse.join(', ') || 'nobody — everyone replied'}.

Blockers from previous weeks, to detect recurrence:
${input.pastBlockers.join('\n') || '(none recorded)'}`;
    }

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
respeta el tiempo de quien lo lee. Apunta a 2-3 páginas, unas 900 palabras —
entra en detalle real por proyecto/persona en vez de rellenar con paja, y
desarrolla cada bloqueo o problema recurrente con su contexto e impacto.
Nada de relleno genérico tipo "gran trabajo en equipo esta semana".

Nunca inventes hechos, herramientas, tickets, sistemas, métricas o nombres
que la persona no haya mencionado — nada de revisiones de cumplimiento,
números de ticket, herramientas concretas (Jira, SharePoint, GitHub
Actions...) o cifras inventadas que no aparezcan en las respuestas de
abajo. Si una respuesta es corta o vaga, esa parte del informe también
debe quedar corta: mejor honesto y breve que relleno con detalle
inventado. El objetivo de palabras es secundario — ajustarse a lo que
realmente se dijo importa mucho más que llegar a esa cifra.

Sin respuesta esta semana: ${input.membersWithoutResponse.join(', ') || 'nadie, todos respondieron'}.

Bloqueos de semanas anteriores para detectar recurrencia:
${input.pastBlockers.join('\n') || '(ninguno registrado)'}`;
  }

  // Segunda llamada a la IA, con los informes de equipo YA GENERADOS (no
  // los checkins en bruto) como entrada — más barata todavía que la
  // primera agregación, el texto de partida ya viene resumido (sección 6.4
  // del doc de producto). Literal del ejemplo de esa sección.
  private buildExecutiveSummaryPrompt(input: ExecutiveSummaryInput): string {
    const language = input.language ?? 'es';
    const informes = input.teamReports
      .map((t) => `--- ${t.teamName} ---\n${t.contentMarkdown}`)
      .join('\n\n');

    if (language === 'en') {
      return `You are the assistant writing the weekly executive summary for "${input.organizationName}", based on the reports already generated for each of its teams this week.

This week's reports, by team:
${informes}

Write an executive summary in English, with this exact format:
1. A short paragraph (3-5 sentences) per team — what mattered about their week, not just a headline.
2. "Cross-team risk" — only if you detect a blocker or dependency affecting more than one team. If there's none, omit this section entirely.
3. "Most urgent this week" — 2-3 company-level items, each with a sentence of context.

Tone: professional, direct, for someone running the company who doesn't have time to read each team's report separately. Aim for 2-3 pages, around 700 words, but never invent detail beyond what's in the team reports below — if a team's report is thin, its paragraph here should be thin too. Don't repeat detail already in each team's report — synthesize at the company level, don't rephrase every line.`;
    }

    return `Eres el asistente que redacta el resumen ejecutivo semanal de la empresa "${input.organizationName}", a partir de los informes ya generados de cada uno de sus equipos esta semana.

Informes de esta semana, por equipo:
${informes}

Redacta un resumen ejecutivo en español, con este formato exacto:
1. Un párrafo breve (3-5 frases) por equipo — qué es lo más relevante de su semana, no solo un titular.
2. "Riesgo que cruza equipos" — solo si detectas un bloqueo o dependencia que afecta a más de un equipo. Si no hay ninguno, omite esta sección entera.
3. "Lo más urgente esta semana" — 2-3 cosas a nivel empresa, cada una con una frase de contexto.

Tono: profesional, directo, para quien dirige la empresa y no tiene tiempo de leer cada informe de equipo por separado. Apunta a 2-3 páginas, unas 700 palabras, pero nunca inventes detalle que no esté en los informes de equipo de abajo — si el informe de un equipo es escueto, su párrafo aquí también debe serlo. No repitas el detalle que ya está en el informe de cada equipo — sintetiza a nivel empresa, no reformules cada línea.`;
  }

  private async callClaude(prompt: string): Promise<string> {
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
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API respondió ${res.status}: ${body}`);
    }

    const json = await res.json();
    return json.content?.[0]?.text ?? '';
  }

  async generateReport(input: AggregateInput): Promise<string> {
    return this.callClaude(this.buildPrompt(input));
  }

  async generateExecutiveSummary(input: ExecutiveSummaryInput): Promise<string> {
    return this.callClaude(this.buildExecutiveSummaryPrompt(input));
  }
}
