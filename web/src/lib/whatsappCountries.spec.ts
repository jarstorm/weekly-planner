import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from './countries';
import {
  whatsappCountryOptions,
  splitWhatsappContact,
  isValidWhatsappNational,
  formatWhatsappContact,
  DEFAULT_WHATSAPP_DIAL,
} from './whatsappCountries';

describe('whatsappCountryOptions', () => {
  it('cada país del selector de WhatsApp tiene un prefijo de marcación asignado', () => {
    const options = whatsappCountryOptions('es');

    expect(options).toHaveLength(COUNTRY_CODES.length);
    const sinPrefijo = options.filter((o) => !o.dial);
    expect(sinPrefijo).toEqual([]);
  });

  it('el default es el prefijo de España (+34)', () => {
    expect(DEFAULT_WHATSAPP_DIAL).toBe('34');
  });
});

describe('splitWhatsappContact — prefijo más largo primero', () => {
  it('un número español real se separa en dial=34 / nacional', () => {
    expect(splitWhatsappContact('34670995609')).toEqual({ dial: '34', national: '670995609' });
  });

  it('un prefijo de 1 dígito (EE.UU./Caribe) no se confunde con uno de 2-3 que empieza igual', () => {
    // "1" (EE.UU.) vs "216" (Túnez) — ambos podrían matchear si se buscara
    // el más corto primero.
    expect(splitWhatsappContact('12025551234')).toEqual({ dial: '1', national: '2025551234' });
    expect(splitWhatsappContact('21671234567')).toEqual({ dial: '216', national: '71234567' });
  });

  it('ignora caracteres no numéricos (espacios, "+") antes de buscar el prefijo', () => {
    expect(splitWhatsappContact('+34 670 99 56 09')).toEqual({ dial: '34', national: '670995609' });
  });

  it('un contacto sin ningún prefijo de marcación conocido cae en el default (España)', () => {
    expect(splitWhatsappContact('0000')).toEqual({ dial: '34', national: '0000' });
  });
});

describe('isValidWhatsappNational', () => {
  it('acepta entre 6 y 12 dígitos', () => {
    expect(isValidWhatsappNational('123456')).toBe(true);
    expect(isValidWhatsappNational('123456789012')).toBe(true);
  });

  it('rechaza menos de 6 o más de 12 dígitos', () => {
    expect(isValidWhatsappNational('12345')).toBe(false);
    expect(isValidWhatsappNational('1234567890123')).toBe(false);
  });

  it('rechaza cualquier caracter que no sea dígito', () => {
    expect(isValidWhatsappNational('67099560a')).toBe(false);
    expect(isValidWhatsappNational('670 995 609')).toBe(false);
  });
});

describe('formatWhatsappContact', () => {
  it('separa dial y nacional con "+" y un espacio, legible para tablas/fichas', () => {
    expect(formatWhatsappContact('34670995609')).toBe('+34 670995609');
  });
});
