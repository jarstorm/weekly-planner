import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

// Un solo uso, ligado al token de reseteo — nunca indexable.
export const metadata: Metadata = NOINDEX_METADATA;

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
