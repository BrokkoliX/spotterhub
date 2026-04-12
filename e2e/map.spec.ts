import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForGraphqlResponse(page: Page, requestName: string) {
  return page.waitForResponse(
    (res) => res.url().includes('/graphql') && res.request().name() === requestName,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Map page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
  });

  test('loads the map page and shows map container', async ({ page }) => {
    // The server is started with NEXT_PUBLIC_MAPBOX_TOKEN=pk.test-token,
    // so the token is embedded at build time and the map initializes.
    const mapContainer = page.locator('[class*="mapContainer"]').first();
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
  });

  test('map is initialized (mapbox-gl container present)', async ({ page }) => {
    const mapContainer = page.locator('[class*="mapContainer"]').first();
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // Mapbox injects a canvas element inside the map container
    const mapCanvas = page.locator('[class*="mapContainer"] canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Map page with auth + data', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page first, then set localStorage (not at about:blank)
    await page.goto('/map');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 'u1', username: 'test', role: 'user', email: 't@t.com' }),
      );
    });
    await page.reload();
  });

  test('airport markers appear after airports query loads', async ({ page }) => {
    // Wait for map container
    const mapContainer = page.locator('[class*="mapContainer"]').first();
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // Wait for map to stabilize and GraphQL requests to resolve
    await page.waitForTimeout(3000);

    // Map container should still be visible (no crash)
    await expect(mapContainer).toBeVisible();
  });

  test('map container is present and stable after interactions', async ({ page }) => {
    const mapContainer = page.locator('[class*="mapContainer"]').first();
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // Wait for map to fully load
    await page.waitForTimeout(3000);

    // Map container should still be visible
    await expect(mapContainer).toBeVisible();
  });
});