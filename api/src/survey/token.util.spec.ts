import { signSurveyToken, verifySurveyToken } from './token.util';

describe('survey token', () => {
  const secret = 'test-secret';

  it('round-trips a valid token', () => {
    const token = signSurveyToken({ memberId: 'abc-123', period: '2026-09-01' }, secret);
    expect(verifySurveyToken(token, secret)).toEqual({ memberId: 'abc-123', period: '2026-09-01' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = signSurveyToken({ memberId: 'abc-123', period: '2026-09-01' }, secret);
    expect(verifySurveyToken(token, 'otro-secret')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signSurveyToken({ memberId: 'abc-123', period: '2026-09-01' }, secret);
    const [, sig] = token.split('~');
    const tampered = `${Buffer.from('other-id:2026-09-01').toString('base64url')}~${sig}`;
    expect(verifySurveyToken(tampered, secret)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifySurveyToken('not-a-token', secret)).toBeNull();
    expect(verifySurveyToken('', secret)).toBeNull();
  });

  it('never contains a dot (breaks the frontend routing middleware)', () => {
    const token = signSurveyToken({ memberId: 'abc-123', period: '2026-09-01' }, secret);
    expect(token).not.toContain('.');
  });
});
