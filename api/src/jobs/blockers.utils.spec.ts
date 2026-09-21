import { extractBlockersSection, isMeaningfulBlocker } from './blockers.utils';

describe('blockers.utils', () => {
  describe('extractBlockersSection', () => {
    it('extracts the Bloqueos section up to the next heading', () => {
      const markdown = `**Logros de la semana**
- Cosa hecha

**Bloqueos**
- Marta lleva 2 semanas esperando feedback de Cliente X.

**Próxima semana**
- Seguir esperando`;
      expect(extractBlockersSection(markdown)).toBe(
        '- Marta lleva 2 semanas esperando feedback de Cliente X.',
      );
    });

    it('extracts the section when it is the last one in the report', () => {
      const markdown = `**Logros de la semana**
- Cosa hecha

**Bloqueos**
- Bloqueo sin cerrar`;
      expect(extractBlockersSection(markdown)).toBe('- Bloqueo sin cerrar');
    });

    it('returns null when there is no Bloqueos section', () => {
      const markdown = `**Logros de la semana**
- Cosa hecha`;
      expect(extractBlockersSection(markdown)).toBeNull();
    });
  });

  describe('isMeaningfulBlocker', () => {
    it('is false for "no blockers" variants', () => {
      expect(isMeaningfulBlocker('No se reportaron bloqueos esta semana.')).toBe(false);
      expect(isMeaningfulBlocker('Sin bloqueos.')).toBe(false);
      expect(isMeaningfulBlocker('Ninguno.')).toBe(false);
    });

    it('is true for a real blocker', () => {
      expect(isMeaningfulBlocker('Marta lleva 2 semanas esperando feedback de Cliente X.')).toBe(true);
    });
  });
});
