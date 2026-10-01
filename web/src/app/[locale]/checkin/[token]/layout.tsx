import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

// Un solo uso, ligado al token de un miembro concreto — nunca indexable.
export const metadata: Metadata = NOINDEX_METADATA;

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
