import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Fuera del árbol [locale] a propósito: las rutas de archivo especiales de
// Next (robots.txt, sitemap.xml) no pasan por next-intl, y el matcher del
// middleware (src/middleware.ts) ya las excluye por tener punto en el path.
// Disallow como defensa en profundidad además del <meta name="robots"> por
// página (ver NOINDEX_METADATA en lib/seo.ts) — ninguna de estas rutas se
// enlaza nunca desde una página pública, así que ni falta que las rastree.
export default function robots(): MetadataRoute.Robots {
  const disallow = ['/app/', '/en/app/', '/checkin/', '/en/checkin/', '/survey/', '/en/survey/', '/verify-email/', '/en/verify-email/', '/verify-member-email/', '/en/verify-member-email/', '/reset-password/', '/en/reset-password/'];

  return {
    rules: { userAgent: '*', allow: '/', disallow },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
