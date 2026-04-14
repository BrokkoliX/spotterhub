import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForGraphqlResponse(page: Page, requestName: string) {
  return page.waitForResponse(
    (res) => res.url().includes('/graphql') && res.request().name() === requestName,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the homepage with hero banner and filter bar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'SpotterSpace' })).toBeVisible();
    await expect(page.getByPlaceholder('Aircraft type (e.g. Boeing 747)')).toBeVisible();
    await expect(page.getByPlaceholder('Airport (e.g. KLAX)')).toBeVisible();
    await expect(page.getByPlaceholder('Airline')).toBeVisible();
    await expect(page.getByPlaceholder('Photographer')).toBeVisible();
  });

  test('displays Recent and Following tabs', async ({ page }) => {
    // Tabs are in the .tabs container, sort pills are in .sortPills
    const tabsSection = page.locator('[class*="tabs"]');
    await expect(tabsSection.getByRole('button', { name: 'Recent', exact: true })).toBeVisible();
    await expect(tabsSection.getByRole('button', { name: 'Following', exact: true })).toBeVisible();
  });

  test('shows sort pills', async ({ page }) => {
    const sortSection = page.locator('[class*="sortPills"]');
    await expect(sortSection.getByRole('button', { name: '🕐 Recent' })).toBeVisible();
    await expect(sortSection.getByRole('button', { name: '⭐ Today' })).toBeVisible();
    await expect(sortSection.getByRole('button', { name: '🔥 This Week' })).toBeVisible();
  });
});

test.describe('Homepage Filter Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('aircraft type typeahead shows dropdown after 2 characters', async ({ page }) => {
    const input = page.getByPlaceholder('Aircraft type (e.g. Boeing 747)');
    await input.fill('Boe');
    await page.waitForTimeout(400); // wait for debounce

    // Dropdown should appear (either results or "Searching…")
    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('airport typeahead shows dropdown after 2 characters', async ({ page }) => {
    const input = page.getByPlaceholder('Airport (e.g. KLAX)');
    await input.fill('LA');
    await page.waitForTimeout(400);

    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('airline typeahead shows dropdown after 2 characters', async ({ page }) => {
    const input = page.getByPlaceholder('Airline');
    await input.fill('Lu');
    await page.waitForTimeout(400);

    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('photographer typeahead shows dropdown after 2 characters', async ({ page }) => {
    const input = page.getByPlaceholder('Photographer');
    await input.fill('ro');
    await page.waitForTimeout(400);

    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('clicking airline dropdown item fills the input', async ({ page }) => {
    const input = page.getByPlaceholder('Airline');
    await input.fill('Luf');
    await page.waitForTimeout(400);

    const firstResult = page.locator('[class*="filterDropdownItem"]').first();
    await firstResult.click();

    // Input should now contain a full airline name (not just the partial "Luf")
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThan(3);
  });

  test('sort pill changes active state', async ({ page }) => {
    const sortSection = page.locator('[class*="sortPills"]');
    const todayPill = sortSection.getByRole('button', { name: '⭐ Today' });
    await todayPill.click();
    await expect(todayPill).toHaveAttribute('class', expect.stringContaining('Active'));

    const recentPill = sortSection.getByRole('button', { name: '🕐 Recent' });
    await recentPill.click();
    await expect(recentPill).toHaveAttribute('class', expect.stringContaining('Active'));
  });

  test('clicking outside dropdown closes it', async ({ page }) => {
    const input = page.getByPlaceholder('Airline');
    await input.fill('Luf');
    await page.waitForTimeout(400);

    const dropdown = page.locator('[class*="filterDropdown"]').first();
    await expect(dropdown).toBeVisible();

    await page.click('[class*="hero"]');
    await expect(dropdown).not.toBeVisible();
  });
});

test.describe('Sign-in flow', () => {
  test('shows sign in page when clicking sign in CTA', async ({ page }) => {
    await page.goto('/');
    const signInLink = page.getByRole('link', { name: /Sign in/ }).first();
    await signInLink.click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('shows communities page when clicking explore communities CTA', async ({ page }) => {
    await page.goto('/');
    const exploreLink = page.getByRole('link', { name: /Explore Communities/ });
    await exploreLink.click();
    await expect(page).toHaveURL(/\/communities/);
  });
});
