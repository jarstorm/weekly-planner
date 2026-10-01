import type { MetadataRoute } from 'next';
import { SITE_URL, localizedPath } from '@/lib/seo';

// Páginas públicas, indexables, iguales en es/en (misma ruta, prefijo "/en"
// para inglés — ver routing.ts). Las rutas con token y /app/* quedan fuera
// a propósito (nunca indexables, ver NOINDEX_METADATA en lib/seo.ts).
const PUBLIC_PATHS = ['/', '/how-it-works', '/login', '/register', '/forgot-password', '/help/telegram', '/legal/privacy', '/legal/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${localizedPath(path, 'es')}`,
    alternates: {
      languages: {
        es: `${SITE_URL}${localizedPath(path, 'es')}`,
        en: `${SITE_URL}${localizedPath(path, 'en')}`,
      },
    },
  }));
}
