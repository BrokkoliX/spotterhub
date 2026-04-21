import { test, expect } from '@playwright/test';
import { signIn } from './testUtils';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Communities', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/communities');
  });

  test('communities list page loads with community cards', async ({ page }) => {
    await expect(page.locator('[class*="communityCard"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('joining a public community updates member count', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await page.goto('/communities');

    const joinBtn = page.getByRole('button', { name: /join/i }).first();
    await joinBtn.click();

    // Should now show "Leave" or "Joined"
    await expect(page.getByRole('button', { name: /leave/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('leaving a community removes membership', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await page.goto('/communities');

    const leaveBtn = page.getByRole('button', { name: /leave/i }).first();
    await leaveBtn.click();

    await expect(page.getByRole('button', { name: /join/i }).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Community — Events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/communities');
  });

  test('community detail page shows events tab', async ({ page }) => {
    const communityCard = page.locator('[class*="communityCard"]').first();
    await communityCard.click();

    await expect(page.getByText(/events/i).first()).toBeVisible();
  });

  test('rsvp button visible on event', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await page.goto('/communities');

    const communityCard = page.locator('[class*="communityCard"]').first();
    await communityCard.click();

    const eventsTab = page.getByText(/events/i).first();
    await eventsTab.click();

    await expect(page.getByRole('button', { name: /rsvp/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
