import jwt from 'jsonwebtoken';

import type { AuthUser } from '../context.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Signs a JWT for the given user payload.
 * Used in dev mode for local authentication. In production, tokens
 * are issued by AWS Cognito — this is only for local development.
 *
 * @param payload - The user identity to encode (sub, email, username).
 * @returns A signed JWT string.
 */
export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
