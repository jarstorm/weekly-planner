import { afterEach, describe, expect, it, vi } from 'vitest';
import { localizedPath, pageAlternates, ogLocale, NOINDEX_METADATA } from './seo';

describe('localizedPath', () => {
  it('"es" (default) sin prefijo, raíz es "/"', () => {
    expect(localizedPath('/', 'es')).toBe('/');
  });

  it('"es" con una ruta normal, sin prefijo', () => {
    expect(localizedPath('/how-it-works', 'es')).toBe('/how-it-works');
  });

  it('"en" con prefijo /en, incluida la raíz', () => {
    expect(localizedPath('/', 'en')).toBe('/en');
    expect(localizedPath('/how-it-works', 'en')).toBe('/en/how-it-works');
  });
});

describe('pageAlternates', () => {
  it('canonical es la versión "es" cuando el locale actual es "es"', () => {
    const result = pageAlternates('/how-it-works', 'es');

    expect(result.canonical).toBe('https://weeklyfeedback.com/how-it-works');
  });

  it('canonical es la versión "en" cuando el locale actual es "en"', () => {
    const result = pageAlternates('/how-it-works', 'en');

    expect(result.canonical).toBe('https://weeklyfeedback.com/en/how-it-works');
  });

  it('hreflang incluye las dos versiones, con x-default apuntando siempre a "es"', () => {
    const result = pageAlternates('/pricing', 'en');

    expect(result.languages).toEqual({
      es: 'https://weeklyfeedback.com/pricing',
      en: 'https://weeklyfeedback.com/en/pricing',
      'x-default': 'https://weeklyfeedback.com/pricing',
    });
  });
});

describe('ogLocale', () => {
  it('"es" → locale es_ES, alternate en_US', () => {
    expect(ogLocale('es')).toEqual({ locale: 'es_ES', alternateLocale: 'en_US' });
  });

  it('"en" → locale en_US, alternate es_ES', () => {
    expect(ogLocale('en')).toEqual({ locale: 'en_US', alternateLocale: 'es_ES' });
  });
});

describe('NOINDEX_METADATA', () => {
  it('bloquea index y follow — para páginas privadas o con token de un solo uso', () => {
    expect(NOINDEX_METADATA).toEqual({ robots: { index: false, follow: false } });
  });
});

describe('SITE_URL — override por variable de entorno', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('quita la barra final de NEXT_PUBLIC_SITE_URL si viene con una', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://otro-dominio.com/');
    vi.resetModules();

    const { SITE_URL } = await import('./seo');

    expect(SITE_URL).toBe('https://otro-dominio.com');
  });
});
