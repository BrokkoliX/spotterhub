import jwt from 'jsonwebtoken';

import type { AuthUser } from '../context.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';
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
