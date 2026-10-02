import { signMemberVerifyToken, verifyMemberVerifyToken } from './member-verify-token.util';

const SECRET = 'test-secret';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('signMemberVerifyToken / verifyMemberVerifyToken', () => {
  it('un token recién firmado se verifica y devuelve el memberId', () => {
    const token = signMemberVerifyToken('member-1', SECRET);

    const payload = verifyMemberVerifyToken(token, SECRET);

    expect(payload?.memberId).toBe('member-1');
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = signMemberVerifyToken('member-1', SECRET);

    expect(verifyMemberVerifyToken(token, 'otro-secreto')).toBeNull();
  });

  it('rechaza un token manipulado (payload alterado sin volver a firmar)', () => {
    const token = signMemberVerifyToken('member-1', SECRET);
    const [payloadB64, sig] = token.split('~');
    const tamperedPayload = Buffer.from('member-2:9999999999999').toString('base64url');

    expect(verifyMemberVerifyToken(`${tamperedPayload}~${sig}`, SECRET)).toBeNull();
    expect(payloadB64).not.toBe(tamperedPayload);
  });

  it('rechaza un token sin el separador "~"', () => {
    expect(verifyMemberVerifyToken('sin-separador', SECRET)).toBeNull();
  });

  it('acepta un token justo por debajo de los 7 días de vida', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = signMemberVerifyToken('member-1', SECRET);

    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + SEVEN_DAYS_MS - 1000);
    const payload = verifyMemberVerifyToken(token, SECRET);

    expect(payload?.memberId).toBe('member-1');
    jest.useRealTimers();
  });

  it('rechaza un token caducado (más de 7 días)', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = signMemberVerifyToken('member-1', SECRET);

    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + SEVEN_DAYS_MS + 1000);
    const payload = verifyMemberVerifyToken(token, SECRET);

    expect(payload).toBeNull();
    jest.useRealTimers();
  });
});
