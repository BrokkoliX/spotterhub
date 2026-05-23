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
/** Compile-time fallback used only when no expiresIn is supplied by the caller. */
const JWT_ACCESS_EXPIRES_IN_DEFAULT = '1h';

/**
 * Signs a short-lived JWT access token for the given user payload.
 *
 * Access-token lifetime is configurable at runtime via SiteSettings
 * (`accessTokenSeconds`); the auth resolver passes that value in here as
 * `expiresIn`. When unspecified — for example from older callers, tests, or
 * any future entrypoint that has not yet been wired up to the DB — we fall
 * back to the historical 1-hour default so behaviour is preserved.
 *
 * @param payload - The user identity to encode (sub, email, username).
 * @param expiresIn - Lifetime in seconds (number) or jsonwebtoken duration
 *   string (e.g. `'1h'`). Defaults to `'1h'`.
 * @returns A signed JWT string.
 */
export function signToken(
  payload: AuthUser,
  expiresIn: number | string = JWT_ACCESS_EXPIRES_IN_DEFAULT,
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
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
