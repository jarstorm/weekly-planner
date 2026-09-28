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

// Encapsula el proveedor de analítica (hoy GoatCounter, self-hosted — ver
// NEXT_PUBLIC_GOATCOUNTER_URL en web/src/app/[locale]/layout.tsx) para que
// cambiar de proveedor el día de mañana sea tocar solo este archivo, no
// cada sitio donde se registra un evento. No hace nada si el script no
// llegó a cargar (dev local, o si el bloqueador de turno lo frena).
export function trackEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined') return;
  window.goatcounter?.count({ path: toPath(name, props), title: name, event: true });
}
