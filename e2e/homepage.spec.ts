import { test, expect } from '@playwright/test';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Homepage — Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('feed displays photo cards after page load', async ({ page }) => {
    const cards = page.locator('[class*="cardInner"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('Recent and Following tabs are present', async ({ page }) => {
    const tabsSection = page.locator('[class*="tabs"]');
    await expect(tabsSection.getByRole('button', { name: 'Recent', exact: true })).toBeVisible();
    await expect(tabsSection.getByRole('button', { name: 'Following', exact: true })).toBeVisible();
  });

  test('sort pills are present', async ({ page }) => {
    const sortSection = page.locator('[class*="sortPills"]');
    await expect(sortSection.getByRole('button', { name: /Recent/ })).toBeVisible();
    await expect(sortSection.getByRole('button', { name: /Today/ })).toBeVisible();
    await expect(sortSection.getByRole('button', { name: /This Week/ })).toBeVisible();
  });

  test('sort pill changes active state on click', async ({ page }) => {
    const sortSection = page.locator('[class*="sortPills"]');
    const todayPill = sortSection.getByRole('button', { name: /Today/ });
    await todayPill.click();

    // Active class should be applied (checking via attribute contains)
    await expect(todayPill).toHaveAttribute('class', expect.stringContaining('Active'));
  });

  test('clicking filter typeahead shows dropdown after 2 characters', async ({ page }) => {
    const input = page.getByPlaceholder('Aircraft type (e.g. Boeing 747)');
    await input.fill('Boe');
    await page.waitForTimeout(400);

    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('clicking outside dropdown closes it', async ({ page }) => {
    const input = page.getByPlaceholder('Aircraft type (e.g. Boeing 747)');
    await input.fill('Boe');
    await page.waitForTimeout(400);

    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();

    await page.click('[class*="hero"]');
    await expect(dropdown).not.toBeVisible();
  });
});

test.describe('Homepage — Navigation', () => {
  test('sign in link navigates to /signin', async ({ page }) => {
    await page.goto('/');
    const signInLink = page.getByRole('link', { name: /Sign in/ }).first();
    await signInLink.click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('explore communities link navigates to /communities', async ({ page }) => {
    await page.goto('/');
    const exploreLink = page.getByRole('link', { name: /Explore Communities/ });
    await exploreLink.click();
    await expect(page).toHaveURL(/\/communities/);
  });
});
