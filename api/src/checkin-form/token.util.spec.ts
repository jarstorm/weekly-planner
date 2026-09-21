import { signCheckinToken, verifyCheckinToken } from './token.util';

describe('checkin-form token', () => {
  const secret = 'test-secret';

  it('round-trips a valid token', () => {
    const token = signCheckinToken({ memberId: 'abc-123', weekStart: '2026-09-14' }, secret);
    expect(verifyCheckinToken(token, secret)).toEqual({ memberId: 'abc-123', weekStart: '2026-09-14' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = signCheckinToken({ memberId: 'abc-123', weekStart: '2026-09-14' }, secret);
    expect(verifyCheckinToken(token, 'otro-secret')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signCheckinToken({ memberId: 'abc-123', weekStart: '2026-09-14' }, secret);
    const [, sig] = token.split('~');
    const tampered = `${Buffer.from('other-id:2026-09-14').toString('base64url')}~${sig}`;
    expect(verifyCheckinToken(tampered, secret)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyCheckinToken('not-a-token', secret)).toBeNull();
    expect(verifyCheckinToken('', secret)).toBeNull();
  });

  // Regresión: un "." en la URL del checkin hacía que el middleware de
  // next-intl la tratara como archivo estático y devolviera 404 — probado
  // en real. El token no puede volver a llevar puntos.
  it('never contains a dot (breaks the frontend routing middleware)', () => {
    const token = signCheckinToken({ memberId: 'abc-123', weekStart: '2026-09-14' }, secret);
    expect(token).not.toContain('.');
  });
});
