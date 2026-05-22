import { afterEach, describe, expect, it, vi } from 'vitest';

import { constantTimeCompare, validateJwtSecret } from '../auth/validateSecret.js';

// ─── constantTimeCompare ─────────────────────────────────────────────────────

describe('constantTimeCompare', () => {
  it('returns true for identical non-empty strings', () => {
    expect(constantTimeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for differing strings of equal length', () => {
    expect(constantTimeCompare('abc123', 'abc124')).toBe(false);
  });

  it('returns false for strings of differing length without leaking via timing', () => {
    expect(constantTimeCompare('abc', 'abcdef')).toBe(false);
  });

  it('returns false when input is undefined', () => {
    expect(constantTimeCompare(undefined, 'expected')).toBe(false);
  });

  it('returns false when expected is undefined', () => {
    expect(constantTimeCompare('input', undefined)).toBe(false);
  });

  it('returns false when input is empty string', () => {
    expect(constantTimeCompare('', 'expected')).toBe(false);
  });

  it('returns false when expected is empty string', () => {
    expect(constantTimeCompare('input', '')).toBe(false);
  });

  it('returns false when both are undefined', () => {
    expect(constantTimeCompare(undefined, undefined)).toBe(false);
  });
});

// ─── validateJwtSecret ───────────────────────────────────────────────────────

describe('validateJwtSecret', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_SECRET = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = ORIGINAL_SECRET;
    }
    vi.restoreAllMocks();
  });

  it('does nothing in development mode regardless of secret quality', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = '';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    validateJwtSecret();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does nothing in test mode', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'short';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    validateJwtSecret();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits in production when JWT_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    validateJwtSecret();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits in production when JWT_SECRET is the empty string', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    validateJwtSecret();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits in production when JWT_SECRET is the dev fallback string', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret-do-not-use-in-production';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    validateJwtSecret();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits in production when JWT_SECRET is shorter than 32 chars', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(31);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    validateJwtSecret();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('passes in production when JWT_SECRET is exactly 32 chars and not the dev fallback', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(32);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    validateJwtSecret();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('passes in production when JWT_SECRET is well above the minimum length', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-strong-production-secret-with-plenty-of-entropy-and-length';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    validateJwtSecret();

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
