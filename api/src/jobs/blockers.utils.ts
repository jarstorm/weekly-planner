// Extrae la sección "Bloqueos" de un informe ya generado — el formato es
// el que le pedimos a la IA en AggregateService.buildPrompt (literal de
// docs/mvp-resumen-semanal-equipos.md, sección 10): "**Bloqueos**" seguido
// del contenido, hasta el próximo título en negrita o el final del texto.
export function extractBlockersSection(markdown: string): string | null {
  const match = markdown.match(/\*\*Bloqueos\*\*\s*\n([\s\S]*?)(?=\n\*\*[^*]+\*\*|\n*$)/i);
  return match ? match[1].trim() : null;
}

// "No hubo bloqueos" no aporta nada a la detección de recurrencia — se
// descarta antes de mandarlo al prompt, no tiene sentido "recordar" que
// una semana no hubo problema.
const NO_BLOCKERS_PATTERN = /no se reportaron|sin bloqueos|ning[uú]n bloqueo|^ninguno\.?$/i;

export function isMeaningfulBlocker(section: string): boolean {
  return !NO_BLOCKERS_PATTERN.test(section);
}
