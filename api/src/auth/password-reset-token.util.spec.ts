import { signPasswordResetToken, verifyPasswordResetToken } from './password-reset-token.util';

const SECRET = 'test-secret';
const ONE_HOUR_MS = 60 * 60 * 1000;

describe('signPasswordResetToken / verifyPasswordResetToken', () => {
  it('un token recién firmado se verifica y devuelve el userId', () => {
    const token = signPasswordResetToken('user-1', SECRET);

    expect(verifyPasswordResetToken(token, SECRET)?.userId).toBe('user-1');
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = signPasswordResetToken('user-1', SECRET);

    expect(verifyPasswordResetToken(token, 'otro-secreto')).toBeNull();
  });

  it('rechaza un payload alterado sin volver a firmar', () => {
    const token = signPasswordResetToken('user-1', SECRET);
    const [, sig] = token.split('~');
    const tamperedPayload = Buffer.from('user-2:9999999999999').toString('base64url');

    expect(verifyPasswordResetToken(`${tamperedPayload}~${sig}`, SECRET)).toBeNull();
  });

  it('rechaza un token sin el separador "~"', () => {
    expect(verifyPasswordResetToken('sin-separador', SECRET)).toBeNull();
  });

  it('acepta un token justo por debajo de 1 hora de vida (más corto que el de verificación de email, a propósito)', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = signPasswordResetToken('user-1', SECRET);

    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + ONE_HOUR_MS - 1000);
    expect(verifyPasswordResetToken(token, SECRET)?.userId).toBe('user-1');
    jest.useRealTimers();
  });

  it('rechaza un token caducado (más de 1 hora) — ventana corta porque resetea la contraseña', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = signPasswordResetToken('user-1', SECRET);

    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + ONE_HOUR_MS + 1000);
    expect(verifyPasswordResetToken(token, SECRET)).toBeNull();
    jest.useRealTimers();
  });
});
