import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForGraphqlResponse(page: Page, requestName: string) {
  return page.waitForResponse(
    (res) => res.url().includes('/graphql') && res.request().name() === requestName,
  );
}

function setAuthLocalStorage(page: Page) {
  // localStorage must be set AFTER a page has loaded (not at about:blank)
  // This is called in beforeEach AFTER page.goto
  return page.evaluate(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'user-1',
        username: 'test',
        role: 'user',
        email: 't@t.com',
      }),
    );
  });
}

// Create a minimal valid JPEG (1x1 red pixel) as a test image
function createTestJpeg(): Buffer {
  // Minimal JPEG with a single red pixel
  const jpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
  return Buffer.from(jpegBase64, 'base64');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Upload page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/upload');
    await setAuthLocalStorage(page);
    await page.reload(); // Reload to apply localStorage auth
  });

  test('shows upload form when signed in', async ({ page }) => {
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();
    await expect(page.getByText(/Drop your photo here/i)).toBeVisible();
    await expect(page.getByPlaceholder('Describe your photo\u2026')).toBeVisible();
  });

  test('shows sign-in prompt when not signed in', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await page.goto('/upload');
    await expect(page.getByText(/need to sign in to upload photos/i)).toBeVisible();
    // Use .first() because the header also has a "Sign in" link
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });

  test('happy path: select file, upload, fill metadata, submit', async ({ page }) => {
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

    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: createTestJpeg(),
    });

    await expect(page.getByText(/Upload failed/i)).toBeVisible({ timeout: 5000 });
    // Should show the preview with a remove button (step is back to 'select' but file is still set)
    await expect(page.getByRole('button', { name: 'Remove image' })).toBeVisible();
  });

  test('tag input: Enter key adds a tag chip', async ({ page }) => {
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();

    const tagInput = page.getByPlaceholder('Add tags (press Enter)');
    await tagInput.fill('sunset');
    await tagInput.press('Enter');

    await expect(page.getByText('sunset')).toBeVisible();
  });

  test('tag input: comma key adds a tag chip', async ({ page }) => {
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();

    const tagInput = page.getByPlaceholder('Add tags (press Enter)');
    await tagInput.fill('sunset');
    await tagInput.press(',');

    await expect(page.getByText('sunset')).toBeVisible();
  });

  test('airport code auto-uppercases', async ({ page }) => {
    await expect(page.getByText('📷 Upload to My Collection')).toBeVisible();

    const airportInput = page.getByPlaceholder('KSFO');
    await airportInput.fill('ksfo');

    expect(await airportInput.inputValue()).toBe('KSFO');
  });

  test('clicking Upload another resets to select step', async ({ page }) => {
    // Intercept mutations
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

    await page.route('http://localhost:4566/spotterspace-photos/*', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // Upload a file to get to done state
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: createTestJpeg(),
    });

    await expect(page.getByPlaceholder('Describe your photo\u2026')).toBeVisible();
    await page.getByRole('button', { name: 'Publish Photo' }).click();
    await expect(page.getByText('Photo uploaded successfully!')).toBeVisible({ timeout: 5000 });

    // Click "Upload another"
    await page.getByRole('button', { name: 'Upload another' }).click();

    // Should be back at select step (dropzone visible)
    await expect(page.getByText(/Drop your photo here/i)).toBeVisible();
    // Caption field should be visible but cleared
    await expect(page.getByPlaceholder('Describe your photo\u2026')).toBeVisible();
    const captionVal = await page.getByPlaceholder('Describe your photo\u2026').inputValue();
    expect(captionVal).toBe('');
  });
});
