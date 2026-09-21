import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Link/redirect/usePathname/useRouter que ya saben del locale actual —
// usar estos en vez de los de next/navigation para no perder el idioma
// al navegar entre páginas.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
