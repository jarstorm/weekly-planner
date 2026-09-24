// Compara "ahora" (en el timezone del equipo) contra reminder_dow/reminder_time
// o cutoff_time. El cron corre cada 15 min, en marcas fijas (:00/:15/:30/:45) —
// la ventana es "hacia adelante" ([ahora, ahora+15min)), no ±15min simétrica.
// Con una ventana simétrica, una hora configurada que no cae justo en un
// múltiplo de 15 (p. ej. 10:07) queda dentro de DOS ticks consecutivos y el
// recordatorio se manda dos veces — el bucket hacia adelante hace que cada
// hora objetivo caiga en un único tick, sin necesitar tabla de idempotencia.
export function isWithinWindow(now: Date, timezone: string, targetTime: string, windowMinutes = 15): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  const nowMinutes = hour * 60 + minute;

  const [targetHour, targetMinute] = targetTime.split(':').map(Number);
  const targetTotal = targetHour * 60 + targetMinute;

  const diff = (targetTotal - nowMinutes + 1440) % 1440;
  return diff < windowMinutes;
}

export function dowInTimezone(now: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

// Día del mes (1-31) en el timezone dado — para SurveyJob, que dispara por
// organizations.survey_day_of_month en vez de un día de la semana.
export function domInTimezone(now: Date, timezone: string): number {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now); // YYYY-MM-DD
  return Number(dateStr.split('-')[2]);
}

// Primer día del mes actual en el timezone dado, formato YYYY-MM-DD —
// equivalente a currentWeekStart pero para la encuesta mensual.
export function currentMonthStart(now: Date, timezone: string): string {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now); // YYYY-MM-DD
  const [year, month] = dateStr.split('-');
  return `${year}-${month}-01`;
}

// Lunes de la semana actual en el timezone dado, formato YYYY-MM-DD.
// Todo el cálculo se hace en UTC (mediodía, para no rozar ningún borde de
// día) a partir de la fecha calendario ya resuelta en el timezone del
// equipo — mezclar Date "local" (parseado sin Z) con toISOString() (que es
// siempre UTC) corre el resultado un día cuando el servidor no corre en
// UTC (p. ej. en Europe/Madrid, UTC+1/+2).
export function currentWeekStart(now: Date, timezone: string): string {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now); // YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  const dow = utcNoon.getUTCDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  utcNoon.setUTCDate(utcNoon.getUTCDate() + diffToMonday);
  return utcNoon.toISOString().slice(0, 10);
}
