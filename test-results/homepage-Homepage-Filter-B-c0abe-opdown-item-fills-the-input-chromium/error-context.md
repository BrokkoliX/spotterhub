# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: homepage.spec.ts >> Homepage Filter Bar >> clicking airline dropdown item fills the input
- Location: e2e/homepage.spec.ts:83:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 3
Received:   3
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "✈️ SpotterHub" [ref=e4] [cursor=pointer]:
        - /url: /
        - generic [ref=e5]: ✈️
        - generic [ref=e6]: SpotterHub
      - navigation [ref=e7]:
        - link "Feed" [ref=e8] [cursor=pointer]:
          - /url: /
        - link "Map" [ref=e9] [cursor=pointer]:
          - /url: /map
        - link "Forum" [ref=e10] [cursor=pointer]:
          - /url: /forum
        - link "Communities" [ref=e11] [cursor=pointer]:
          - /url: /communities
      - textbox "Search" [ref=e13]:
        - /placeholder: Search photos, users…
      - generic [ref=e14]:
        - link "Sign in" [ref=e15] [cursor=pointer]:
          - /url: /signin
        - link "Sign up" [ref=e16] [cursor=pointer]:
          - /url: /signup
  - main [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e21]:
        - generic [ref=e22]: 🛩️
        - heading "SpotterHub" [level=1] [ref=e23]
        - paragraph [ref=e24]: The world's community for aviation photography
        - generic [ref=e25]:
          - generic [ref=e26]: 📷 Thousands of photos
          - generic [ref=e27]: ✈️ Aircraft from around the world
          - generic [ref=e28]: 👥 Join a global community
        - generic [ref=e29]:
          - link "Sign in to upload" [ref=e30] [cursor=pointer]:
            - /url: /signin
          - link "Explore Communities" [ref=e31] [cursor=pointer]:
            - /url: /communities
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]:
              - generic: 🔍
              - textbox "Aircraft type (e.g. Boeing 747)" [ref=e36]
            - generic [ref=e37]:
              - generic: 🛫
              - textbox "Airport (e.g. KLAX)" [ref=e38]
            - generic [ref=e39]:
              - generic: ✈️
              - textbox "Airline" [ref=e40]: Luf
              - generic [ref=e42] [cursor=pointer]: No airlines found
            - generic [ref=e43]:
              - generic: 📷
              - textbox "Photographer" [ref=e44]
          - generic [ref=e45]:
            - button "🕐 Recent" [ref=e46] [cursor=pointer]:
              - generic [ref=e47]: 🕐
              - generic [ref=e48]: Recent
            - button "⭐ Today" [ref=e49] [cursor=pointer]:
              - generic [ref=e50]: ⭐
              - generic [ref=e51]: Today
            - button "🔥 This Week" [ref=e52] [cursor=pointer]:
              - generic [ref=e53]: 🔥
              - generic [ref=e54]: This Week
            - button "🚀 This Month" [ref=e55] [cursor=pointer]:
              - generic [ref=e56]: 🚀
              - generic [ref=e57]: This Month
            - button "🏆 All Time" [ref=e58] [cursor=pointer]:
              - generic [ref=e59]: 🏆
              - generic [ref=e60]: All Time
        - generic [ref=e61]:
          - button "Recent" [ref=e62] [cursor=pointer]
          - button "Following" [ref=e63] [cursor=pointer]
        - generic [ref=e64]:
          - generic [ref=e65]: 📷
          - paragraph [ref=e66]: No photos match your filters.
          - paragraph [ref=e67]: Be the first to share an aviation photo!
  - button "Open Next.js Dev Tools" [ref=e73] [cursor=pointer]:
    - img [ref=e74]
  - alert [ref=e77]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | 
  3   | // ─── Helpers ────────────────────────────────────────────────────────────────
  4   | 
  5   | async function waitForGraphqlResponse(page: Page, requestName: string) {
  6   |   return page.waitForResponse(
  7   |     (res) => res.url().includes('/graphql') && res.request().name() === requestName,
  8   |   );
  9   | }
  10  | 
  11  | // ─── Tests ───────────────────────────────────────────────────────────────────
  12  | 
  13  | test.describe('Homepage', () => {
  14  |   test.beforeEach(async ({ page }) => {
  15  |     await page.goto('/');
  16  |   });
  17  | 
  18  |   test('loads the homepage with hero banner and filter bar', async ({ page }) => {
  19  |     await expect(page.getByRole('heading', { name: 'SpotterHub' })).toBeVisible();
  20  |     await expect(page.getByPlaceholder('Aircraft type (e.g. Boeing 747)')).toBeVisible();
  21  |     await expect(page.getByPlaceholder('Airport (e.g. KLAX)')).toBeVisible();
  22  |     await expect(page.getByPlaceholder('Airline')).toBeVisible();
  23  |     await expect(page.getByPlaceholder('Photographer')).toBeVisible();
  24  |   });
  25  | 
  26  |   test('displays Recent and Following tabs', async ({ page }) => {
  27  |     // Tabs are in the .tabs container, sort pills are in .sortPills
  28  |     const tabsSection = page.locator('[class*="tabs"]');
  29  |     await expect(tabsSection.getByRole('button', { name: 'Recent', exact: true })).toBeVisible();
  30  |     await expect(tabsSection.getByRole('button', { name: 'Following', exact: true })).toBeVisible();
  31  |   });
  32  | 
  33  |   test('shows sort pills', async ({ page }) => {
  34  |     const sortSection = page.locator('[class*="sortPills"]');
  35  |     await expect(sortSection.getByRole('button', { name: '🕐 Recent' })).toBeVisible();
  36  |     await expect(sortSection.getByRole('button', { name: '⭐ Today' })).toBeVisible();
  37  |     await expect(sortSection.getByRole('button', { name: '🔥 This Week' })).toBeVisible();
  38  |   });
  39  | });
  40  | 
  41  | test.describe('Homepage Filter Bar', () => {
  42  |   test.beforeEach(async ({ page }) => {
  43  |     await page.goto('/');
  44  |   });
  45  | 
  46  |   test('aircraft type typeahead shows dropdown after 2 characters', async ({ page }) => {
  47  |     const input = page.getByPlaceholder('Aircraft type (e.g. Boeing 747)');
  48  |     await input.fill('Boe');
  49  |     await page.waitForTimeout(400); // wait for debounce
  50  | 
  51  |     // Dropdown should appear (either results or "Searching…")
  52  |     const dropdown = page.locator('[class*="filterDropdown"]').first();
  53  |     await expect(dropdown).toBeVisible();
  54  |   });
  55  | 
  56  |   test('airport typeahead shows dropdown after 2 characters', async ({ page }) => {
  57  |     const input = page.getByPlaceholder('Airport (e.g. KLAX)');
  58  |     await input.fill('LA');
  59  |     await page.waitForTimeout(400);
  60  | 
  61  |     const dropdown = page.locator('[class*="filterDropdown"]').first();
  62  |     await expect(dropdown).toBeVisible();
  63  |   });
  64  | 
  65  |   test('airline typeahead shows dropdown after 2 characters', async ({ page }) => {
  66  |     const input = page.getByPlaceholder('Airline');
  67  |     await input.fill('Lu');
  68  |     await page.waitForTimeout(400);
  69  | 
  70  |     const dropdown = page.locator('[class*="filterDropdown"]').first();
  71  |     await expect(dropdown).toBeVisible();
  72  |   });
  73  | 
  74  |   test('photographer typeahead shows dropdown after 2 characters', async ({ page }) => {
  75  |     const input = page.getByPlaceholder('Photographer');
  76  |     await input.fill('ro');
  77  |     await page.waitForTimeout(400);
  78  | 
  79  |     const dropdown = page.locator('[class*="filterDropdown"]').first();
  80  |     await expect(dropdown).toBeVisible();
  81  |   });
  82  | 
  83  |   test('clicking airline dropdown item fills the input', async ({ page }) => {
  84  |     const input = page.getByPlaceholder('Airline');
  85  |     await input.fill('Luf');
  86  |     await page.waitForTimeout(400);
  87  | 
  88  |     const firstResult = page.locator('[class*="filterDropdownItem"]').first();
  89  |     await firstResult.click();
  90  | 
  91  |     // Input should now contain a full airline name (not just the partial "Luf")
  92  |     const value = await input.inputValue();
> 93  |     expect(value.length).toBeGreaterThan(3);
      |                          ^ Error: expect(received).toBeGreaterThan(expected)
  94  |   });
  95  | 
  96  |   test('sort pill changes active state', async ({ page }) => {
  97  |     const sortSection = page.locator('[class*="sortPills"]');
  98  |     const todayPill = sortSection.getByRole('button', { name: '⭐ Today' });
  99  |     await todayPill.click();
  100 |     await expect(todayPill).toHaveAttribute('class', expect.stringContaining('Active'));
  101 | 
  102 |     const recentPill = sortSection.getByRole('button', { name: '🕐 Recent' });
  103 |     await recentPill.click();
  104 |     await expect(recentPill).toHaveAttribute('class', expect.stringContaining('Active'));
  105 |   });
  106 | 
  107 |   test('clicking outside dropdown closes it', async ({ page }) => {
  108 |     const input = page.getByPlaceholder('Airline');
  109 |     await input.fill('Luf');
  110 |     await page.waitForTimeout(400);
  111 | 
  112 |     const dropdown = page.locator('[class*="filterDropdown"]').first();
  113 |     await expect(dropdown).toBeVisible();
  114 | 
  115 |     await page.click('[class*="hero"]');
  116 |     await expect(dropdown).not.toBeVisible();
  117 |   });
  118 | });
  119 | 
  120 | test.describe('Sign-in flow', () => {
  121 |   test('shows sign in page when clicking sign in CTA', async ({ page }) => {
  122 |     await page.goto('/');
  123 |     const signInLink = page.getByRole('link', { name: /Sign in/ }).first();
  124 |     await signInLink.click();
  125 |     await expect(page).toHaveURL(/\/signin/);
  126 |   });
  127 | 
  128 |   test('shows communities page when clicking explore communities CTA', async ({ page }) => {
  129 |     await page.goto('/');
  130 |     const exploreLink = page.getByRole('link', { name: /Explore Communities/ });
  131 |     await exploreLink.click();
  132 |     await expect(page).toHaveURL(/\/communities/);
  133 |   });
  134 | });
  135 | 
```