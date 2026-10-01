import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

// Todo /app/* es el panel autenticado — nada de valor para buscadores, y
// cada página muestra datos de una cuenta concreta.
export const metadata: Metadata = NOINDEX_METADATA;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
