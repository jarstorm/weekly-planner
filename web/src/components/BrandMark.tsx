'use client';

import { useId } from 'react';
import { Link } from '@/i18n/navigation';
import { useHomeHref } from '@/lib/useHomeHref';

// Ícono "burbuja + check": las respuestas del equipo se convierten en un
// informe revisado. Elegido entre 3 propuestas (opción A).
export function BrandIcon({ size = 30 }: { size?: number }) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="brand-mark">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4E9068" />
          <stop offset="1" stopColor="#2E5E42" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradId})`} />
      <path d="M20 15H44a6 6 0 0 1 6 6V36a6 6 0 0 1-6 6H29L19 50V42a6 6 0 0 1-5-6V21a6 6 0 0 1 6-6Z" fill="#fff" />
      <g fill="none" stroke="#3B7453" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 23H43" />
        <path d="M21 30.5H30" />
        <path d="M34.5 30.5l3.2 3.2 6-6.4" />
      </g>
    </svg>
  );
}

// Insignia "Beta" — activa por defecto. El día que el producto deje de
// serlo, poner NEXT_PUBLIC_SHOW_BETA_BADGE=false en el build de producción
// y desaparece sola, sin tocar código.
const SHOW_BETA_BADGE = process.env.NEXT_PUBLIC_SHOW_BETA_BADGE !== 'false';

// Logo clicable en toda la app: sin sesión lleva a la portada, con sesión
// al dashboard (useHomeHref) — antes cada página decidía por su cuenta si
// envolverlo en un <Link href="/"> o dejarlo sin enlace, con resultado
// inconsistente (en la mayoría de páginas no hacía nada al pulsarlo).
export function BrandMark() {
  const homeHref = useHomeHref();
  return (
    <Link href={homeHref} className="brand">
      <span className="brand-icon-wrap">
        <BrandIcon />
        {SHOW_BETA_BADGE && <span className="brand-beta">Beta</span>}
      </span>
      <span className="brand-word">
        Weekly<b>Feedback</b>
      </span>
    </Link>
  );
}
