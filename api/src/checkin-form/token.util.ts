import { createHmac, timingSafeEqual } from 'crypto';

export interface CheckinTokenPayload {
  memberId: string;
  weekStart: string;
}

// Token stateless firmado (HMAC-SHA256), no hace falta guardar nada aparte
// en la base de datos — el propio link es la credencial, mismo criterio
// de confianza que ya se usa en los webhooks (member_id resuelto server-side,
// no por un login). Formato: <payload en base64url>~<firma en base64url>.
// Separador "~", no "." — el middleware de next-intl (web/src/middleware.ts)
// excluye del enrutado cualquier path con un punto, asumiéndolo un archivo
// estático (matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)') — un token
// con "." en la URL rompía el ruteo con 404, probado en real.
export function signCheckinToken(payload: CheckinTokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(`${payload.memberId}:${payload.weekStart}`).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}~${sig}`;
}

export function verifyCheckinToken(token: string, secret: string): CheckinTokenPayload | null {
  const [payloadB64, sig] = token.split('~');
  if (!payloadB64 || !sig) return null;

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const [memberId, weekStart] = Buffer.from(payloadB64, 'base64url').toString('utf-8').split(':');
  if (!memberId || !weekStart) return null;
  return { memberId, weekStart };
}
