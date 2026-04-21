import { type Page, type FullConfig } from '@playwright/test';

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/**
 * Signs in via the cookie-based sign-in API route and waits for navigation.
 * Use this instead of setting localStorage directly.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
}

/**
 * Signs out via the cookie-based sign-out API route.
 */
export async function signOut(page: Page) {
  await fetch('/api/auth/signout', { method: 'POST' });
  await page.goto('/');
}

/**
 * Navigates to /upload after ensuring the user is authenticated.
 * Checks /api/auth/me — if not authenticated, redirects to /signin.
 */
export async function authGuard(page: Page, email: string, password: string) {
  await page.goto('/api/auth/me');
  const isAuthenticated = !(page.url().includes('/signin'));
  if (!isAuthenticated) {
    await signIn(page, email, password);
  }
}

// ─── Photo Helpers ────────────────────────────────────────────────────────────

/** Creates a minimal valid JPEG as a Buffer (1x1 red pixel). */
export function createTestJpeg(): Buffer {
  const jpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
  return Buffer.from(jpegBase64, 'base64');
}

// ─── Dev Server Setup ────────────────────────────────────────────────────────

/**
 * Global beforeAll hook for Playwright projects.
 * Ensures the dev servers are reachable before any test runs.
 */
export async function globalBeforeAll(_config: FullConfig) {
  // Wait for web server to be ready (handled by playwright's webServer config)
  // This function is a placeholder for any global setup that must run once.
}
