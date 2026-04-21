import { test, expect, type Page } from '@playwright/test';
import { signIn } from './testUtils';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForGraphqlResponse(page: Page, requestName: string) {
  return page.waitForResponse(
    (res) => res.url().includes('/graphql') && res.request().name() === requestName,
  );
}

// Create a minimal valid JPEG (1x1 red pixel) as a test image
function createTestJpeg(): Buffer {
  const jpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
  return Buffer.from(jpegBase64, 'base64');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Upload page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows upload form when signed in', async ({ page }) => {
    // Sign in via cookie-based auth (uses test user credentials)
    await signIn(page, 'test@example.com', 'password123');

    await page.goto('/upload');
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();
    await expect(page.getByText(/Drop your photo here/i)).toBeVisible();
    await expect(page.getByPlaceholder('Describe your photo\u2026')).toBeVisible();
  });

  test('shows sign-in prompt when not signed in', async ({ page }) => {
    // Navigate to upload without signing in
    await page.goto('/upload');
    await expect(page.getByText(/need to sign in to upload photos/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });

  test('happy path: select file, upload, fill metadata, submit', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    // Intercept GET_UPLOAD_URL mutation
    await page.route('**/graphql', async (route) => {
      const postData = route.request().postData();
      if (postData && postData.includes('GetUploadUrl')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getUploadUrl: {
                url: 'http://localhost:4566/spotterspace-photos/test-key.jpg',
                key: 'test-key.jpg',
              },
            },
          }),
        });
        return;
      }
      if (postData && postData.includes('CreatePhoto')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              createPhoto: {
                id: 'photo-new-123',
                caption: 'Test caption',
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    // Intercept S3 PUT
    await page.route('http://localhost:4566/spotterspace-photos/*', async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.goto('/upload');
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: createTestJpeg(),
    });

    // Wait for form step (metadata form visible)
    await expect(page.getByPlaceholder('Describe your photo\u2026')).toBeVisible();

    // Fill in metadata
    await page.getByPlaceholder('Describe your photo\u2026').fill('Beautiful sunset over Seattle');
    await page.getByPlaceholder('KSFO').fill('KSEA');

    // Submit
    await page.getByRole('button', { name: 'Publish Photo' }).click();

    // Should show success state
    await expect(page.getByText('Photo uploaded successfully!')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: 'View photo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload another' })).toBeVisible();
  });

  test('S3 PUT failure shows error and stays on select step', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    // Intercept GET_UPLOAD_URL mutation
    await page.route('**/graphql', async (route) => {
      const postData = route.request().postData();
      if (postData && postData.includes('GetUploadUrl')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getUploadUrl: {
                url: 'http://localhost:4566/spotterspace-photos/test-key.jpg',
                key: 'test-key.jpg',
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    // Make S3 PUT fail
    await page.route('http://localhost:4566/spotterspace-photos/*', async (route) => {
      await route.fulfill({ status: 500 });
    });

    await page.goto('/upload');
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: createTestJpeg(),
    });

    await expect(page.getByText(/Upload failed/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Remove image' })).toBeVisible();
  });

  test('tag input: Enter key adds a tag chip', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await page.goto('/upload');

    const tagInput = page.getByPlaceholder('Add tags (press Enter)');
    await tagInput.fill('sunset');
    await tagInput.press('Enter');

    await expect(page.getByText('sunset')).toBeVisible();
  });

  test('tag input: comma key adds a tag chip', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await page.goto('/upload');

    const tagInput = page.getByPlaceholder('Add tags (press Enter)');
    await tagInput.fill('sunset');
    await tagInput.press(',');

    await expect(page.getByText('sunset')).toBeVisible();
  });

  test('airport code auto-uppercases', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');
    await page.goto('/upload');

    const airportInput = page.getByPlaceholder('KSFO');
    await airportInput.fill('ksfo');

    expect(await airportInput.inputValue()).toBe('KSFO');
  });

  test('clicking Upload another resets to select step', async ({ page }) => {
    await signIn(page, 'test@example.com', 'password123');

    await page.route('**/graphql', async (route) => {
      const postData = route.request().postData();
      if (postData && postData.includes('GetUploadUrl')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getUploadUrl: {
                url: 'http://localhost:4566/spotterspace-photos/test-key.jpg',
                key: 'test-key.jpg',
              },
            },
          }),
        });
        return;
      }
      if (postData && postData.includes('CreatePhoto')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              createPhoto: {
                id: 'photo-new-123',
                caption: 'Test caption',
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('http://localhost:4566/spotterspace-photos/*', async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.goto('/upload');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: createTestJpeg(),
    });

    await expect(page.getByPlaceholder('Describe your photo\u2026')).toBeVisible();
    await page.getByRole('button', { name: 'Publish Photo' }).click();
    await expect(page.getByText('Photo uploaded successfully!')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Upload another' }).click();
    await expect(page.getByText(/Drop your photo here/i)).toBeVisible();
    const captionVal = await page.getByPlaceholder('Describe your photo\u2026').inputValue();
    expect(captionVal).toBe('');
  });
});
