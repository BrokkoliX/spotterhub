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
