import { signEmailVerificationToken, verifyEmailVerificationToken } from './verify-email-token.util';

const SECRET = 'test-secret';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('signEmailVerificationToken / verifyEmailVerificationToken', () => {
  it('un token recién firmado se verifica y devuelve el userId', () => {
    const token = signEmailVerificationToken('user-1', SECRET);

    expect(verifyEmailVerificationToken(token, SECRET)?.userId).toBe('user-1');
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = signEmailVerificationToken('user-1', SECRET);

    expect(verifyEmailVerificationToken(token, 'otro-secreto')).toBeNull();
  });

  it('rechaza un payload alterado sin volver a firmar', () => {
    const token = signEmailVerificationToken('user-1', SECRET);
    const [, sig] = token.split('~');
    const tamperedPayload = Buffer.from('user-2:9999999999999').toString('base64url');

    expect(verifyEmailVerificationToken(`${tamperedPayload}~${sig}`, SECRET)).toBeNull();
  });

  it('rechaza un token sin el separador "~"', () => {
    expect(verifyEmailVerificationToken('sin-separador', SECRET)).toBeNull();
  });

  it('acepta un token justo por debajo de los 7 días de vida', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = signEmailVerificationToken('user-1', SECRET);

    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + SEVEN_DAYS_MS - 1000);
    expect(verifyEmailVerificationToken(token, SECRET)?.userId).toBe('user-1');
    jest.useRealTimers();
  });

  it('rechaza un token caducado (más de 7 días) — único freno contra un link viejo filtrado', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = signEmailVerificationToken('user-1', SECRET);

    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + SEVEN_DAYS_MS + 1000);
    expect(verifyEmailVerificationToken(token, SECRET)).toBeNull();
    jest.useRealTimers();
  });
});
