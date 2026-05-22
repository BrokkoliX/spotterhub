import { test, expect, type Page } from '@playwright/test';
import { signIn, signOut } from './testUtils';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Auth — Sign In', () => {
  test('sign in with valid credentials redirects to /', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('sign in with wrong password shows error message', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    // URL should stay on /signin
    await expect(page).toHaveURL(/\/signin/);
  });

  test('signed-in user navigating to /upload sees upload form', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    await page.goto('/upload');
    await expect(page).not.toHaveURL(/\/signin/);
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();
  });

  test('signed-out user navigating to /upload is redirected to sign-in', async ({ page }) => {
    await page.goto('/upload');

    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByText(/need to sign in to upload photos/i)).toBeVisible();
  });
});

test.describe('Auth — Session Cookie', () => {
  test('access_token cookie is HttpOnly (not readable via document.cookie)', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    const cookieValue = await page.evaluate(() => {
      const cookies = document.cookie.split('; ');
      const tokenCookie = cookies.find((c) => c.startsWith('access_token='));
      return tokenCookie ?? null;
    });

    // HttpOnly cookies are not accessible via document.cookie
    expect(cookieValue).toBeNull();
  });

  test('sign-out clears both access_token and refresh_token cookies', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await signOut(page);

    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'access_token');
    const refreshToken = cookies.find((c) => c.name === 'refresh_token');

    expect(accessToken?.value).toBe('');
    expect(refreshToken?.value).toBe('');
  });
});

test.describe('Auth — Sign Out', () => {
  test('sign out redirects to / and clears session', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await signOut(page);

    await page.goto('/upload');
    await expect(page).toHaveURL(/\/signin/);
  });
});

// ─── CSRF guard ─────────────────────────────────────────────────────────────
//
// Sprint 2 (S2.3) tightened csrfGuard so state-changing requests (POST, PUT,
// PATCH, DELETE) must carry either:
//   - an `Origin` header matching the configured WEB_BASE_URL, OR
//   - a `Sec-Fetch-Site` header with a value of `same-origin` or `same-site`.
//
// These tests use Playwright's APIRequestContext to make raw HTTP calls that
// bypass the browser fetch sandbox — simulating a curl-based attacker rather
// than a cross-origin browser request. The expected behaviour is a 403 when
// neither signal is present and a successful response (any 2xx, 4xx other
// than 403) when an Origin matches.
test.describe('Auth — CSRF guard', () => {
  // The API URL the web app proxies to. Match the dev rewrite target so this
  // test runs against the same endpoint the web tier hits.
  const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
  // The configured front-end origin csrfGuard accepts. Mirrors WEB_BASE_URL
  // in the API config; the dev default is http://localhost:3000.
  const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3000';

  test('POST /graphql without Origin or Sec-Fetch-Site is rejected with 403', async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: {
        'content-type': 'application/json',
        // Explicitly do NOT send Origin or Sec-Fetch-Site — APIRequestContext
        // will only send what we list here, so this simulates the attacker
        // model.
      },
      data: {
        query: 'mutation { signOut }',
      },
      // Don't follow redirects or auto-fail on non-2xx; we want to inspect
      // the status directly.
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
  });

  test('POST /graphql with mismatched Origin is rejected with 403', async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example.com',
      },
      data: {
        query: 'mutation { signOut }',
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
  });

  test('POST /graphql with matching Origin is accepted (not 403)', async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: {
        'content-type': 'application/json',
        origin: WEB_ORIGIN,
      },
      data: {
        // Use a query (read-only) so the actual mutation surface isn't
        // exercised; we only care that csrfGuard does not block the request.
        query: '{ __typename }',
      },
      failOnStatusCode: false,
    });

    // Anything other than 403 indicates csrfGuard let the request through.
    // 200 is the expected success; 4xx/5xx for other reasons is also fine —
    // we are testing only that the CSRF middleware did not reject.
    expect(response.status()).not.toBe(403);
  });

  test('GET /graphql without Origin is allowed (read-only methods bypass csrfGuard)', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/graphql?query=%7B__typename%7D`, {
      failOnStatusCode: false,
    });

    expect(response.status()).not.toBe(403);
  });
});
