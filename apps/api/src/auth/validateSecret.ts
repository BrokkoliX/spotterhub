import { timingSafeEqual } from 'node:crypto';

/**
 * Validates a shared secret using a constant-time comparison to prevent timing attacks.
 * Used for protecting privileged admin HTTP endpoints.
 *
 * @param input - The secret value supplied by the caller.
 * @param expected - The expected secret value (from environment).
 * @returns true if the secrets match, false otherwise.
 */
export function constantTimeCompare(
  input: string | undefined,
  expected: string | undefined,
): boolean {
  if (!input || !expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Validates that the JWT_SECRET meets minimum strength requirements.
 * Call this after loading secrets in both the long-lived server and Lambda handler.
 *
 * Exits the process if validation fails in production.
 */
export function validateJwtSecret(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'dev-secret-do-not-use-in-production' || secret.length < 32) {
    console.error(
      'FATAL: JWT_SECRET is not set or is the dev fallback. Refusing to start in production.',
    );
    process.exit(1);
  }
}
