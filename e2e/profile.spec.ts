import { test, expect } from '@playwright/test';
import { signIn } from './testUtils';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('User Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('visiting /u/[username] shows user profile and photo grid', async ({ page }) => {
    // Click on the first user link from a photo card
    const firstUserLink = page.locator('[class*="user"]').first();
    const href = await firstUserLink.getAttribute('href');

    if (href) {
      await firstUserLink.click();
      await page.waitForURL(/\/u\/[^/]+/);
      // Should have a photo grid or empty state
      await expect(
        page
          .locator('[class*="cardInner"]')
          .first()
          .or(page.getByText(/no photos/i)),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('follow button visible on other user profile', async ({ page }) => {
    const firstUserLink = page.locator('[class*="user"]').first();
    const href = await firstUserLink.getAttribute('href');

    if (href) {
      await firstUserLink.click();
      await page.waitForURL(/\/u\/[^/]+/);
      // Follow button should be present (not on own profile)
      await expect(page.getByRole('button', { name: /follow/i }).first()).toBeVisible();
    }
  });

  test('tapping Follow changes button to Unfollow', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    const firstUserLink = page.locator('[class*="user"]').first();
    const href = await firstUserLink.getAttribute('href');

    if (href) {
      await firstUserLink.click();
      await page.waitForURL(/\/u\/[^/]+/);

      const followBtn = page.getByRole('button', { name: /follow/i }).first();
      await followBtn.click();

      // Should now show Unfollow
      await expect(page.getByRole('button', { name: /unfollow/i }).first()).toBeVisible();
    }
  });

  test('regression: profile page mounts without throwing on initial render', async ({ page }) => {
    // Reproduces the prod failure mode: on first render, urql returns
    // `data: undefined` and the buggy code accessed `userResult.data`,
    // throwing "Cannot read properties of undefined (reading 'data')".
    // Listen for any uncaught page error during navigation + first paint
    // and fail the test if one is observed.
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Pick a real username from the feed to ensure the route exists.
    const firstUserLink = page.locator('[class*="user"]').first();
    const href = await firstUserLink.getAttribute('href');
    if (!href) {
      test.skip(true, 'No user link found on the home feed; cannot exercise profile route');
      return;
    }

    await page.goto(href);
    await page.waitForURL(/\/u\/[^/]+/);
    // Wait for the page to settle past the initial render where the bug
    // would have manifested.
    await expect(
      page
        .locator('[class*="cardInner"]')
        .first()
        .or(page.getByText(/no photos/i)),
    ).toBeVisible({ timeout: 5000 });

    const dataAccessErrors = pageErrors.filter((e) =>
      /Cannot read properties of undefined \(reading 'data'\)/.test(e.message),
    );
    expect(dataAccessErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});
