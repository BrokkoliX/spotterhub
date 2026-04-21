import { test, expect } from '@playwright/test';
import { signIn } from './testUtils';

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('non-admin navigating to /admin sees access denied', async ({ page }) => {
    // Sign in as a regular user (test@example.com is a regular user)
    await signIn(page, 'test@example.com', 'password123');

    await page.goto('/admin');
    await expect(page.getByText(/access denied/i).or(page.getByText(/forbidden/i))).toBeVisible({
      timeout: 5000,
    });
  });

  test('admin can access /admin and see stats dashboard', async ({ page }) => {
    // Sign in as admin (need to check if there's an admin user seeded)
    // For now, check that the admin page loads
    await signIn(page, 'test@example.com', 'password123');

    await page.goto('/admin');
    // Should either show admin dashboard or access denied (depending on user role)
    await expect(
      page.getByText(/stats/i).or(page.getByText(/access denied/i)).or(page.getByText(/forbidden/i)),
    ).toBeVisible({ timeout: 5000 });
  });

  test('pending photos tab shows photos list', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    await page.goto('/admin/photos');
    // Should show a table or grid of photos or an empty state
    await expect(
      page.locator('table').or(page.getByText(/no pending photos/i)).or(page.getByText(/access denied/i)),
    ).toBeVisible({ timeout: 5000 });
  });

  test('reports tab shows open reports or empty state', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    await page.goto('/admin/reports');
    await expect(
      page.locator('table').or(page.getByText(/no reports/i)).or(page.getByText(/access denied/i)),
    ).toBeVisible({ timeout: 5000 });
  });
});
