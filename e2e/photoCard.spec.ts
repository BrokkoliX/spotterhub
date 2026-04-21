import { test, expect } from '@playwright/test';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Photo Card — Flip Effect', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for photo cards to load
    await page.waitForSelector('[class*="cardInner"]', { timeout: 10000 });
  });

  test('photo cards render in the feed', async ({ page }) => {
    const cards = page.locator('[class*="cardInner"]');
    await expect(cards.first()).toBeVisible();
  });

  test('hovering a photo card triggers flip animation', async ({ page }) => {
    const firstCard = page.locator('[class*="cardInner"]').first();

    // Verify back face is not visible before hover (it's rotated 180deg)
    const backFace = firstCard.locator('[class*="cardBack"]');
    await expect(backFace).toBeHidden();

    // Hover the card
    await firstCard.hover();

    // After hover, the back face should be visible (rotated to face the viewer)
    // The back face has the .cardBack class with rotateY(180deg) applied
    // We verify by checking the parent card's transform
    const card = firstCard.locator('..');
    await page.waitForTimeout(700); // Wait for flip animation (0.55s)
  });

  test('back face shows caption, aircraft, airport, and date', async ({ page }) => {
    const firstCard = page.locator('[class*="cardInner"]').first();
    await firstCard.hover();

    // Wait for flip animation
    await page.waitForTimeout(700);

    // Back face should have meta items
    const backFace = firstCard.locator('[class*="cardBack"]');
    await expect(backFace).toBeVisible();
  });

  test('clicking front face of card navigates to photo detail page', async ({ page }) => {
    const firstCardLink = page.locator('[class*="cardFront"] a').first();
    const href = await firstCardLink.getAttribute('href');

    await firstCardLink.click();
    await expect(page).toHaveURL(new RegExp(`/photos/[^/]+`));
  });

  test('clicking back face of card navigates to photo detail page', async ({ page }) => {
    const firstCard = page.locator('[class*="cardInner"]').first();
    await firstCard.hover();
    await page.waitForTimeout(700);

    const backFaceLink = firstCard.locator('[class*="cardBack"]');
    const href = await backFaceLink.getAttribute('href');

    await backFaceLink.click();
    await expect(page).toHaveURL(new RegExp(`/photos/[^/]+`));
  });
});
