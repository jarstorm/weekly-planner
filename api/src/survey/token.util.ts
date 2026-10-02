import { createHmac, timingSafeEqual } from 'crypto';

export interface SurveyTokenPayload {
  memberId: string;
  surveyId: string;
}

// Mismo esquema que checkin-form/token.util.ts (HMAC-SHA256, sin estado en
// base de datos) pero con secreto propio (SURVEY_TOKEN_SECRET) — así
// rotar uno no invalida los links del otro. Antes el payload llevaba el
// "period" (primer día del mes); con la encuesta de un solo envío, el
// identificador natural es la propia encuesta (surveys.id).
export function signSurveyToken(payload: SurveyTokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(`${payload.memberId}:${payload.surveyId}`).toString('base64url');
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

  const [memberId, surveyId] = Buffer.from(payloadB64, 'base64url').toString('utf-8').split(':');
  if (!memberId || !surveyId) return null;
  return { memberId, surveyId };
}
