'use client';

type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    goatcounter?: {
      count: (opts: { path: string; title?: string; event?: boolean }) => void;
    };
  }
}

function toPath(name: string, props?: EventProps): string {
  const entries = Object.entries(props ?? {}).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return name;
  const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  return `${name}?${query}`;
}

// count.js carga de forma asíncrona (next/script strategy="afterInteractive"),
// así que una llamada en el primer render de un componente puede dispararse
// antes de que exista window.goatcounter. Se encola y se vacía desde el
// onLoad del script (ver GoatCounterScript), en vez de perder ese evento.
let goatcounterReady = false;
let pending: Array<() => void> = [];

function send(fn: () => void): void {
  if (typeof window === 'undefined') return;
  if (goatcounterReady) fn();
  else pending.push(fn);
}

export function markGoatcounterReady(): void {
  goatcounterReady = true;
  pending.forEach((fn) => fn());
  pending = [];
}

// Encapsula el proveedor de analítica (hoy GoatCounter, self-hosted — ver
// NEXT_PUBLIC_GOATCOUNTER_URL en web/src/app/[locale]/layout.tsx) para que
// cambiar de proveedor el día de mañana sea tocar solo este archivo, no
// cada sitio donde se registra un evento. No hace nada si el script no
// llegó a cargar (dev local, o si el bloqueador de turno lo frena).
export function trackEvent(name: string, props?: EventProps): void {
  send(() => window.goatcounter?.count({ path: toPath(name, props), title: name, event: true }));
}

// GoatCounter solo cuenta la carga inicial de página sola (su propio
// on_load, desactivado vía data-goatcounter-settings en el layout). En una
// SPA de Next.js las navegaciones entre páginas son client-side y no
// recargan el script, así que hay que llamar a count() a mano en cada
// cambio de ruta — ver AnalyticsPageview.
export function trackPageview(path: string): void {
  send(() => window.goatcounter?.count({ path }));
}
