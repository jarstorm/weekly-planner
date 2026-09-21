import { currentWeekStart, dowInTimezone, isWithinWindow } from './date.utils';

describe('date.utils', () => {
  describe('isWithinWindow', () => {
    // Ventana hacia adelante [ahora, ahora+15min) — simula un tick de cron
    // en una marca fija (:00/:15/:30/:45). Ver el comentario en date.utils.ts:
    // con una ventana simétrica, una hora que no cae en múltiplo de 15
    // dispararía en dos ticks consecutivos (recordatorio duplicado).

    it('is true right at the target time (tick lands exactly on target)', () => {
      const now = new Date('2026-09-18T08:00:00Z'); // viernes 10:00 en Europe/Madrid (UTC+2 en verano)
      expect(isWithinWindow(now, 'Europe/Madrid', '10:00')).toBe(true);
    });

    it('is true for a target later in the same bucket', () => {
      const now = new Date('2026-09-18T08:00:00Z'); // tick a las 10:00 Madrid
      expect(isWithinWindow(now, 'Europe/Madrid', '10:14')).toBe(true); // 10:14, dentro del bucket [10:00,10:15)
    });

    it('is false for a target already past (previous bucket)', () => {
      const now = new Date('2026-09-18T08:15:00Z'); // tick a las 10:15 Madrid
      expect(isWithinWindow(now, 'Europe/Madrid', '10:00')).toBe(false); // ya lo capturó el tick anterior
    });

    it('is false for a target not due yet (next bucket)', () => {
      const now = new Date('2026-09-18T08:00:00Z'); // tick a las 10:00 Madrid
      expect(isWithinWindow(now, 'Europe/Madrid', '10:15')).toBe(false); // le toca al próximo tick
    });

    it('a target not aligned to 15 min fires on exactly one of the two nearby ticks', () => {
      const target = '10:07';
      const tickBefore = new Date('2026-09-18T08:00:00Z'); // 10:00 Madrid
      const tickAfter = new Date('2026-09-18T08:15:00Z'); // 10:15 Madrid
      expect(isWithinWindow(tickBefore, 'Europe/Madrid', target)).toBe(true);
      expect(isWithinWindow(tickAfter, 'Europe/Madrid', target)).toBe(false);
    });

    it('respects a different timezone than UTC/Madrid', () => {
      const now = new Date('2026-09-18T15:00:00Z'); // 10:00 en America/Bogota (UTC-5, sin DST)
      expect(isWithinWindow(now, 'America/Bogota', '10:05')).toBe(true);
    });

    it('wraps around midnight', () => {
      const now = new Date('2026-09-18T21:50:00Z'); // 23:50 Madrid
      expect(isWithinWindow(now, 'Europe/Madrid', '00:02')).toBe(true); // 00:02 del día siguiente
    });
  });

  describe('dowInTimezone', () => {
    it('returns the correct day of week (0=domingo..6=sábado)', () => {
      const friday = new Date('2026-09-18T08:00:00Z'); // viernes en Madrid
      expect(dowInTimezone(friday, 'Europe/Madrid')).toBe(5);
    });

    it('accounts for a day boundary crossed by the timezone offset', () => {
      // 23:30 del viernes en Madrid es aún viernes en UTC, pero ya sábado no —
      // se prueba el caso donde el offset cruza la medianoche.
      const lateFriday = new Date('2026-09-18T22:30:00Z'); // 00:30 sábado en Madrid
      expect(dowInTimezone(lateFriday, 'Europe/Madrid')).toBe(6);
    });
  });

  describe('currentWeekStart', () => {
    it('returns the Monday of the current week', () => {
      const friday = new Date('2026-09-18T08:00:00Z');
      expect(currentWeekStart(friday, 'Europe/Madrid')).toBe('2026-09-14');
    });

    it('returns the same date when today is Monday', () => {
      const monday = new Date('2026-09-14T08:00:00Z');
      expect(currentWeekStart(monday, 'Europe/Madrid')).toBe('2026-09-14');
    });

    it('rolls back to the previous Monday on Sunday', () => {
      const sunday = new Date('2026-09-20T08:00:00Z');
      expect(currentWeekStart(sunday, 'Europe/Madrid')).toBe('2026-09-14');
    });
  });
});
