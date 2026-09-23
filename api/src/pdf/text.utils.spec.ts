import { sanitizeText } from './text.utils';

// Bug real detectado generando un informe de muestra para la landing:
// Groq mete de vez en cuando espacios Unicode que Helvetica/AFM (fuente de
// pdfkit) no tiene glifo — pdfkit los pintaba como "/" visible ("Stripe
// /Tax", "cron de 15 /min").
describe('sanitizeText', () => {
  it('normaliza narrow no-break space (U+202F, visto en producción) a espacio normal', () => {
    expect(sanitizeText('cron de 15 min')).toBe('cron de 15 min');
  });

  it('normaliza non-breaking space (U+00A0) y otras variantes del bloque U+2000-200A', () => {
    expect(sanitizeText('Stripe Tax')).toBe('Stripe Tax');
    expect(sanitizeText('a b c')).toBe('a b c');
  });

  it('elimina zero-width space / BOM sin dejar un espacio de más', () => {
    expect(sanitizeText('foo​bar﻿')).toBe('foobar');
  });

  it('texto normal sin espacios especiales queda intacto', () => {
    expect(sanitizeText('Logros de la semana')).toBe('Logros de la semana');
  });
});
