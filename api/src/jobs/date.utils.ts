// Compara "ahora" (en el timezone del equipo) contra reminder_dow/reminder_time
// o cutoff_time, con una ventana de 15 minutos (el cron corre cada 15 min).
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

  return Math.abs(nowMinutes - targetTotal) < windowMinutes;
}

export function dowInTimezone(now: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

// Lunes de la semana actual en el timezone dado, formato YYYY-MM-DD.
export function currentWeekStart(now: Date, timezone: string): string {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now); // YYYY-MM-DD
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}
