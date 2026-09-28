import { useId } from 'react';

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

export function BrandMark() {
  return (
    <span className="brand">
      <BrandIcon />
      <span className="brand-word">
        Weekly<b>Feedback</b>
      </span>
      <span className="brand-beta">Beta</span>
    </span>
  );
}
