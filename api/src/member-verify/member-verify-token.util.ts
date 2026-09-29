import { createHmac, timingSafeEqual } from 'crypto';

// Mismo esquema que auth/verify-email-token.util.ts (HMAC-SHA256, sin
// estado en base de datos, con expiración embebida) pero secreto propio
// (MEMBER_VERIFY_TOKEN_SECRET) — firma memberId en vez de userId.
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días, igual que la verificación de cuenta

export interface MemberVerifyTokenPayload {
  memberId: string;
  issuedAt: number;
}

export function signMemberVerifyToken(memberId: string, secret: string): string {
  const issuedAt = Date.now();
  const payloadB64 = Buffer.from(`${memberId}:${issuedAt}`).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}~${sig}`;
}

export function verifyMemberVerifyToken(token: string, secret: string): MemberVerifyTokenPayload | null {
  const [payloadB64, sig] = token.split('~');
  if (!payloadB64 || !sig) return null;

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const [memberId, issuedAtStr] = Buffer.from(payloadB64, 'base64url').toString('utf-8').split(':');
  const issuedAt = Number(issuedAtStr);
  if (!memberId || !issuedAt || Date.now() - issuedAt > TTL_MS) return null;
  return { memberId, issuedAt };
}
