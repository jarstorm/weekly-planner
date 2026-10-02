import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryOptions, countryName } from './countries';

describe('countryOptions', () => {
  it('devuelve una opción por cada código ISO, sin perder ninguno', () => {
    const options = countryOptions('es');

    expect(options).toHaveLength(COUNTRY_CODES.length);
    expect(new Set(options.map((o) => o.code)).size).toBe(COUNTRY_CODES.length);
  });

  it('ordena alfabéticamente por el nombre en el idioma activo, no por código ISO', () => {
    const options = countryOptions('es');
    const names = options.map((o) => o.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'es'));

    expect(names).toEqual(sorted);
    // España ("ES") no cae cerca del principio por código, pero sí alfabéticamente.
    expect(options.find((o) => o.code === 'ES')?.name).toBe('España');
  });

  it('el mismo país sale con nombre distinto según el locale', () => {
    const es = countryOptions('es').find((o) => o.code === 'DE');
    const en = countryOptions('en').find((o) => o.code === 'DE');

    expect(es?.name).toBe('Alemania');
    expect(en?.name).toBe('Germany');
  });
});

describe('countryName', () => {
  it('string vacío para null/undefined, sin llamar a Intl.DisplayNames', () => {
    expect(countryName(null, 'es')).toBe('');
    expect(countryName(undefined, 'es')).toBe('');
  });

  it('devuelve el nombre localizado para un código conocido', () => {
    expect(countryName('ES', 'es')).toBe('España');
    expect(countryName('ES', 'en')).toBe('Spain');
  });
});
