import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días — a diferencia de los tokens de checkin/survey
// (sin expiry, gated solo por si ya hay respuesta en BD), aquí sí hace
// falta: el link vive en la bandeja de correo indefinidamente y no hay un
// estado "ya usado" que lo invalide (verificar dos veces es idempotente a
// propósito, ver AuthService.verifyEmail) — la expiración es la única
// defensa contra un link viejo filtrado.

export interface EmailVerificationTokenPayload {
  userId: string;
  issuedAt: number;
}

// Mismo esquema que checkin-form/token.util.ts y survey/token.util.ts
// (HMAC-SHA256, sin estado en base de datos) con secreto propio
// (EMAIL_VERIFICATION_TOKEN_SECRET) — más el campo issuedAt para poder
// expirar, que los otros dos no necesitan.
export function signEmailVerificationToken(userId: string, secret: string): string {
  const issuedAt = Date.now();
  const payloadB64 = Buffer.from(`${userId}:${issuedAt}`).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}~${sig}`;
}

export function verifyEmailVerificationToken(token: string, secret: string): EmailVerificationTokenPayload | null {
  const [payloadB64, sig] = token.split('~');
  if (!payloadB64 || !sig) return null;

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const [userId, issuedAtStr] = Buffer.from(payloadB64, 'base64url').toString('utf-8').split(':');
  const issuedAt = Number(issuedAtStr);
  if (!userId || !issuedAt || Date.now() - issuedAt > TTL_MS) return null;
  return { userId, issuedAt };
}
