import { currentWeekStart, dowInTimezone, isWithinWindow } from './date.utils';

describe('date.utils', () => {
  describe('isWithinWindow', () => {
    it('is true right at the target time', () => {
      const now = new Date('2026-09-18T08:00:00Z'); // viernes 10:00 en Europe/Madrid (UTC+2 en verano)
      expect(isWithinWindow(now, 'Europe/Madrid', '10:00')).toBe(true);
    });

    it('is true a few minutes inside the window', () => {
      const now = new Date('2026-09-18T08:10:00Z'); // 10:10 Madrid
      expect(isWithinWindow(now, 'Europe/Madrid', '10:00')).toBe(true);
    });

    it('is false outside the window', () => {
      const now = new Date('2026-09-18T08:20:00Z'); // 10:20 Madrid, ventana de 15 min
      expect(isWithinWindow(now, 'Europe/Madrid', '10:00')).toBe(false);
    });

    it('respects a different timezone than UTC/Madrid', () => {
      const now = new Date('2026-09-18T15:05:00Z'); // 10:05 en America/Bogota (UTC-5, sin DST)
      expect(isWithinWindow(now, 'America/Bogota', '10:00')).toBe(true);
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
