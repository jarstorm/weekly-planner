import { createHmac, timingSafeEqual } from 'crypto';

// 1 hora, no 7 días como el de verificación de email — a diferencia de
// aquel (un link que vive indefinidamente en la bandeja hasta que alguien
// lo abra), este resetea la contraseña de la cuenta: una ventana corta
// limita el daño si el email se filtra o queda abierto en una bandeja
// compartida.
const TTL_MS = 60 * 60 * 1000;

export interface PasswordResetTokenPayload {
  userId: string;
  issuedAt: number;
}

// Mismo esquema HMAC-SHA256 que verify-email-token.util.ts, secreto propio
// (PASSWORD_RESET_TOKEN_SECRET) — nunca reutilizar el de verificación de
// email: son ceremonias distintas (confirmar acceso a un email vs.
// autorizar cambiar la contraseña) y no deben compartir secreto.
export function signPasswordResetToken(userId: string, secret: string): string {
  const issuedAt = Date.now();
  const payloadB64 = Buffer.from(`${userId}:${issuedAt}`).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}~${sig}`;
}

export function verifyPasswordResetToken(token: string, secret: string): PasswordResetTokenPayload | null {
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
