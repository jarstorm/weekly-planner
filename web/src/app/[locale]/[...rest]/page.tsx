import { notFound } from 'next/navigation';

// Catch-all para cualquier ruta bajo [locale] que no matchee ninguna
// página real — sin esto, Next.js nunca "entra" en el árbol de archivos
// de [locale] para un path desconocido y usa su 404 genérico en vez de
// [locale]/not-found.tsx (probado en real: /algo-que-no-existe devolvía
// el fallback de Next, no nuestra página).
export default function CatchAll() {
  notFound();
}
