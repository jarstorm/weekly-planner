// URL pública del sitio para metadataBase, canonical, hreflang, OG y el
// sitemap. Mismo patrón que NEXT_PUBLIC_API_BASE_URL/NEXT_PUBLIC_GOATCOUNTER_URL
// (web/src/app/[locale]/layout.tsx): se puede sobreescribir en build time,
// pero por defecto ya apunta al dominio real — así un build sin la variable
// seteada (p.ej. local) sigue generando metadata válida, no rota.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://weeklyfeedback.com').replace(/\/$/, '');

// Mismo criterio que routing.ts (localePrefix: 'as-needed'): es es el
// locale por defecto sin prefijo ("/how-it-works"), en va con prefijo
// ("/en/how-it-works").
export function localizedPath(path: string, locale: string): string {
  const suffix = path === '/' ? '' : path;
  if (locale === 'en') return `/en${suffix}`;
  return suffix || '/';
}

// `alternates` para generateMetadata: canonical de la página actual +
// hreflang de ambos idiomas. x-default apunta a es (locale por defecto).
export function pageAlternates(path: string, locale: string) {
  const es = `${SITE_URL}${localizedPath(path, 'es')}`;
  const en = `${SITE_URL}${localizedPath(path, 'en')}`;
  return {
    canonical: locale === 'en' ? en : es,
    languages: { es, en, 'x-default': es },
  };
}

export function ogLocale(locale: string): { locale: string; alternateLocale: string } {
  return locale === 'en' ? { locale: 'en_US', alternateLocale: 'es_ES' } : { locale: 'es_ES', alternateLocale: 'en_US' };
}

// Páginas privadas o ligadas a un token de un solo uso: nunca deben
// indexarse (no aportan nada en buscadores y algunas filtrarían el token
// en el snippet/caché de Google si se indexaran).
export const NOINDEX_METADATA = { robots: { index: false, follow: false } } as const;
