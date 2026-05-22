import jwt from 'jsonwebtoken';

import type { AuthUser } from '../context.js';

// ─── Static validation at module load time ──────────────────────────────────────
// Production-strength validation (NODE_ENV check, length, dev fallback) lives in
// apps/api/src/auth/validateSecret.ts and is invoked from each entrypoint AFTER
// secrets are loaded from Secrets Manager. The check here only enforces presence
// so signToken/verifyToken cannot run with an undefined key.

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const JWT_SECRET = rawSecret;
const JWT_ACCESS_EXPIRES_IN = '1h';

/**
 * Signs a short-lived JWT access token for the given user payload.
 * Access tokens expire in 1 hour. Browser clients receive a separate
 * HttpOnly refresh cookie that persists for 7 days.
 *
 * @param payload - The user identity to encode (sub, email, username).
 * @returns A signed JWT string.
 */
export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
}

/**
 * Verifies and decodes a JWT, returning the user payload.
 *
 * @param token - The JWT string to verify.
 * @returns The decoded user payload, or null if invalid.
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}
