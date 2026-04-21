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
        page.locator('[class*="cardInner"]').first().or(page.getByText(/no photos/i)),
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
});
