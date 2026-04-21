import { test, expect } from '@playwright/test';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('search page loads with search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('typing in search box triggers results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Boeing');
    await page.waitForTimeout(800); // debounce

    // Should show photo cards or an empty state
    const cards = page.locator('[class*="cardInner"]');
    // Either results are shown or empty state
    await expect(cards.first().or(page.getByText(/no results/i))).toBeVisible();
  });
});
