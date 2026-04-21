import { test, expect } from '@playwright/test';
import { signIn } from './testUtils';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Photo Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('photo detail page loads with full-size image', async ({ page }) => {
    // Navigate to the first photo card
    const firstCardLink = page.locator('[class*="cardFront"] a').first();
    const href = await firstCardLink.getAttribute('href');
    await firstCardLink.click();

    await expect(page).toHaveURL(new RegExp(`/photos/[^/]+`));
    // Image should be visible
    await expect(page.locator('img').first()).toBeVisible();
  });

  test('like button is visible on photo detail page', async ({ page }) => {
    const firstCardLink = page.locator('[class*="cardFront"] a').first();
    await firstCardLink.click();

    await expect(page.locator('[class*="likeBtn"]').first()).toBeVisible();
  });

  test('comment form is visible on photo detail page', async ({ page }) => {
    const firstCardLink = page.locator('[class*="cardFront"] a').first();
    await firstCardLink.click();

    // Comment form should be present
    await expect(page.getByPlaceholder(/add a comment/i)).toBeVisible();
  });
});

test.describe('Photo Detail Page — Authenticated Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
  });

  test('submitting a comment adds it below the photo', async ({ page }) => {
    // Navigate to a photo directly
    const firstCardLink = page.locator('[class*="cardFront"] a').first();
    const href = await firstCardLink.getAttribute('href');
    await page.goto(`/photos/${href?.split('/').pop()}`);

    const commentInput = page.getByPlaceholder(/add a comment/i);
    await commentInput.fill('Great shot!');
    await page.getByRole('button', { name: /post comment/i }).click();

    // Comment should appear
    await expect(page.getByText('Great shot!')).toBeVisible({ timeout: 5000 });
  });
});
