import { createHmac, timingSafeEqual } from 'crypto';

export interface SurveyTokenPayload {
  memberId: string;
  period: string; // primer día del mes, YYYY-MM-DD
}

// Mismo esquema que checkin-form/token.util.ts (HMAC-SHA256, sin estado en
// base de datos) pero con secreto propio (SURVEY_TOKEN_SECRET) — así
// rotar uno no invalida los links del otro.
export function signSurveyToken(payload: SurveyTokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(`${payload.memberId}:${payload.period}`).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}~${sig}`;
}

export function verifySurveyToken(token: string, secret: string): SurveyTokenPayload | null {
  const [payloadB64, sig] = token.split('~');
  if (!payloadB64 || !sig) return null;

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const [memberId, period] = Buffer.from(payloadB64, 'base64url').toString('utf-8').split(':');
  if (!memberId || !period) return null;
  return { memberId, period };
}
