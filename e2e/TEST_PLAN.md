# SpotterSpace E2E Test Plan

> Status: **DRAFT** — covers existing tests, deprecated patterns, and new test scenarios to add.
> Last updated: 2026-04-21

---

## 1. Testing Overview

| Layer | Tool | Scope | Count |
|---|---|---|---|
| API unit/integration | Vitest + Apollo `executeOperation` | In-process, real Prisma DB | 16 files |
| Web component unit | Vitest + Testing Library | React component logic | 4 files |
| E2E / browser | Playwright | Full HTTP stack, real browser | **3 files → planned 10+** |

The existing Playwright suite covers the **homepage**, **upload flow**, and **map page** only.
The `upload.spec.ts` helper `setAuthLocalStorage()` uses the **old localStorage auth pattern** — this is now deprecated and must be updated to use the cookie-based `/api/auth/me` endpoint before any new E2E tests are written.

---

## 2. Auth Pattern — Breaking Change

The app switched from localStorage JWT to **HttpOnly cookies** (commit `502e6306`). All E2E tests that set auth via:

```ts
// OLD — broken after cookie migration
localStorage.setItem('token', 'test-token');
localStorage.setItem('user', JSON.stringify({ ... }));
```

…must be replaced with the new sign-in helper:

```ts
// NEW — signs in via the cookie-based API route
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
}
```

**Files that need updating immediately:**
- `e2e/upload.spec.ts` — `setAuthLocalStorage()` helper + auth assertions
- `e2e/map.spec.ts` — same issue

---

## 3. Current E2E Coverage

### 3.1 `e2e/homepage.spec.ts` ✅ Good — keep as-is
- Hero banner + filter bar load
- Recent / Following tabs present
- Sort pills present + active state
- Aircraft type / airport / airline / photographer typeahead dropdowns
- Clicking outside closes dropdown
- Sign-in CTA navigates to `/signin`
- Explore Communities CTA navigates to `/communities`

**Gaps:**
- No assertion that photo cards are actually rendered
- No test for the **Following tab** when user is not following anyone (empty state)
- No test for sort pill **filtering** (clicking Today — does it actually filter results?)
- No test for filter bar **clearing** a selected filter

### 3.2 `e2e/upload.spec.ts` ⚠️ Deprecated auth — needs rewrite
- Auth guard (sign-in prompt) ✅
- Form rendering ✅
- File select → metadata → submit happy path ✅
- S3 PUT failure error state ✅
- Tag input (Enter / comma) ✅
- Airport code auto-uppercase ✅
- Upload another reset ✅

**Issues to fix:**
- `setAuthLocalStorage()` sets fake localStorage (broken — cookies are the new auth mechanism)
- Test "shows sign-in prompt when not signed in" still reads `localStorage.removeItem()` — needs update

### 3.3 `e2e/map.spec.ts` ⚠️ Deprecated auth — needs rewrite
- Map container loads ✅
- Mapbox canvas present ✅
- Container stable after interactions ✅

**Issues:**
- `localStorage.setItem('token', ...)` — broken after cookie migration
- No test for **clicking an airport marker** and seeing a popup
- No test for **photos nearby** functionality working on the map
- No test for **GPS locate-me** button

---

## 4. Test Plan: New + Updated E2E Specs

### 4.1 Auth & Sessions (`auth.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| AUTH-01 | Sign up with valid credentials → redirected to `/` | P0 |
| AUTH-02 | Sign in with correct email/password → cookie set, redirected to `/` | P0 |
| AUTH-03 | Sign in with wrong password → error message, no cookie | P0 |
| AUTH-04 | Signed-in user navigates to `/upload` → sees upload form (not sign-in prompt) | P0 |
| AUTH-05 | Signed-out user navigates to `/upload` → sees sign-in prompt | P0 |
| AUTH-06 | Sign out → cookie cleared, user redirected to `/` | P0 |
| AUTH-07 | JWT token in HttpOnly cookie is not accessible via JS (`document.cookie` does not contain `access_token`) | P0 |
| AUTH-08 | Email verification flow: user signs up → verify-email page → click link → redirected to `/` with session active | P1 |
| AUTH-09 | Password reset: forgot-password page → enter email → reset page → set new password → sign in with new password | P1 |

### 4.2 Photo Card Flip (`photoCard.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| PC-01 | Photo card renders in feed with thumbnail visible | P0 |
| PC-02 | Hovering a photo card triggers flip animation | P0 |
| PC-03 | Back face shows: caption, aircraft, airline, airport code, date | P0 |
| PC-04 | Clicking front face of card → navigates to photo detail page | P0 |
| PC-05 | Clicking back face of card → navigates to photo detail page | P0 |
| PC-06 | Flipping a card and quickly clicking → still navigates correctly | P1 |
| PC-07 | Photo card with no caption: back face shows available fields, caption area hidden | P1 |
| PC-08 | Photo card with no aircraft/airline: those fields hidden on back face | P1 |

### 4.3 Homepage & Feed (`homepage.spec.ts`) — **UPDATE existing + extend**

| ID | Test | Priority |
|---|---|---|
| HF-01 | Feed displays photo cards after page load | P0 |
| HF-02 | Tapping Following tab shows only photos from followed users/airports | P0 |
| HF-03 | Tapping Following tab when following no one → empty state message | P0 |
| HF-04 | Sort pill "Today" filters to today's photos | P1 |
| HF-05 | Sort pill "This Week" filters to this week's photos | P1 |
| HF-06 | Selecting an aircraft type filter → feed updates to matching photos | P0 |
| HF-07 | Selecting an airport filter → feed updates | P0 |
| HF-08 | Selecting multiple filters → feed shows intersection | P1 |
| HF-09 | Clearing a filter chip → feed reloads with removed filter | P1 |
| HF-10 | Load more button appears when `hasNextPage` is true | P0 |
| HF-11 | Clicking Load more appends more photos to the grid | P1 |
| HF-12 | Empty feed (no photos) shows empty state message | P1 |

### 4.4 Upload Flow (`upload.spec.ts`) — **UPDATE: fix auth + extend**

| ID | Test | Priority |
|---|---|---|
| UP-01 | Signed-in user sees upload form with dropzone | P0 |
| UP-02 | Selecting a JPEG file → preview displayed | P0 |
| UP-03 | Submitting file without metadata → validation error (airport required?) | P1 |
| UP-04 | Full upload: file + caption + airport + tags → success state → "View photo" link works | P0 |
| UP-05 | S3 upload failure → error shown, user stays on form, can retry | P0 |
| UP-06 | Tag input: Enter key adds tag chip | P0 |
| UP-07 | Tag input: comma key adds tag chip | P0 |
| UP-08 | Tag input: backspace removes last chip when input is empty | P1 |
| UP-09 | Airport code auto-uppercases | P0 |
| UP-10 | "Upload another" resets form to initial state | P0 |
| UP-11 | HEIC file accepted (mime type validated server-side) | P0 |

### 4.5 Photo Detail Page (`photoDetail.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| PD-01 | Photo detail page loads with full-size image | P0 |
| PD-02 | Like button: tap → count increments, button fills | P0 |
| PD-03 | Like button: tap again → count decrements, button unfills (idempotent) | P0 |
| PD-04 | Comment form: submit non-empty comment → comment appears below | P0 |
| PD-05 | Comment form: submit empty comment → validation error | P0 |
| PD-06 | Aircraft/operator info displayed | P0 |
| PD-07 | Map shows photo location pin | P0 |
| PD-08 | "More from this aircraft" section shows related photos | P1 |
| PD-09 | "More from this aircraft" section links to full search | P1 |
| PD-10 | Photo deleted by owner → redirected to feed with success toast | P1 |
| PD-11 | Report button → report modal opens | P1 |

### 4.6 Map Page (`map.spec.ts`) — **UPDATE: fix auth + extend**

| ID | Test | Priority |
|---|---|---|
| MP-01 | Map container loads and Mapbox canvas is present | P0 |
| MP-02 | Airport markers appear on map | P0 |
| MP-03 | Clicking airport marker → popup shows airport info + photo count | P0 |
| MP-04 | Clicking airport popup → navigates to airport page | P1 |
| MP-05 | Clicking "Locate me" button → browser geolocation requested → map centers on user location | P1 |
| MP-06 | Photos appear on map within the visible bounds | P1 |
| MP-07 | Clicking a photo marker → photo popup/preview | P1 |

### 4.7 Search (`search.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| SE-01 | Search page: typing in search box returns results | P0 |
| SE-02 | Searching by caption text → matching photos shown | P0 |
| SE-03 | Searching by airport code → matching photos shown | P0 |
| SE-04 | Searching by aircraft type → matching photos shown | P0 |
| SE-05 | Empty search query → no results shown | P0 |
| SE-06 | Search results show photo cards (clickable) | P0 |

### 4.8 User Profile (`profile.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| PR-01 | Visiting `/u/[username]` shows user profile + photo grid | P0 |
| PR-02 | Profile shows: display name, bio, photo count, follower count | P0 |
| PR-03 | Follow button visible on other user's profile | P0 |
| PR-04 | Tapping Follow → count increments, button changes to Unfollow | P0 |
| PR-05 | Tapping Unfollow → count decrements | P0 |
| PR-06 | Own profile → sees "Edit Profile" button | P0 |
| PR-07 | Edit profile page: update display name + bio → saved → profile updated | P0 |
| PR-08 | Albums tab: shows user's albums | P1 |

### 4.9 Communities (`communities.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| CO-01 | Communities list page loads with community cards | P0 |
| CO-02 | Joining a public community → member count increments | P0 |
| CO-03 | Leaving a community → removed from members list | P0 |
| CO-04 | Community detail page: shows events, forum, members | P0 |
| CO-05 | RSVP to an event → attendee count increments | P0 |
| CO-06 | Cancel RSVP → attendee count decrements | P0 |
| CO-07 | Event at capacity: maybe RSVP still allowed | P1 |
| CO-08 | Create a forum thread in a community | P1 |
| CO-09 | Reply to a forum thread | P1 |

### 4.10 Admin Panel (`admin.spec.ts`) — **NEW**

| ID | Test | Priority |
|---|---|---|
| AD-01 | Admin page: stats dashboard loads | P0 |
| AD-02 | Pending photos tab: shows unmoderated photos | P0 |
| AD-03 | Approve a photo → status changes, photo appears in public feed | P0 |
| AD-04 | Reject a photo → status changes, removed from public feed | P0 |
| AD-05 | Reports tab: shows open reports | P0 |
| AD-06 | Resolve/dismiss a report → removed from open list | P0 |
| AD-07 | Users tab: search for a user | P1 |
| AD-08 | Suspend a user → user can no longer sign in | P1 |
| AD-09 | Non-admin navigating to `/admin` → access denied | P0 |

---

## 5. Deprecated Tests to Remove

| File | Reason |
|---|---|
| `apps/web/src/__tests__/auth.test.tsx` | Tests localStorage auth which is no longer used. `AuthProvider` now calls `GET /api/auth/me` via cookie. Tests should be rewritten against the new auth flow or replaced by E2E `auth.spec.ts`. |
| `apps/web/src/__tests__/upload.test.tsx` | Tests localStorage auth state. Upload functionality is fully covered by `e2e/upload.spec.ts` (once auth is fixed). Consider keeping only the airport auto-uppercase unit test, move the rest to E2E. |

**Do not delete** `apps/web/src/__tests__/photoGrid.test.tsx` — it tests component logic (empty state, load more button) that is unit-testable without auth.

---

## 6. Test Data Strategy

E2E tests should **not** rely on a seeded production-like dataset. Recommended approach:

1. **Use the existing API test seeding** (`createTestUser` in `testHelpers.ts`) — consider exposing a minimal API endpoint or seed script that E2E tests can call before a suite runs to create known users, photos, airports.
2. **Authenticated E2E users**: Create a `testutils/seed-test-user.ts` that the `beforeAll` hook calls via GraphQL mutation to create a real user in the test database, then signs in via the `/api/auth/signin` route (not localStorage).
3. **Isolate tests**: Each Playwright project (worker) should get a clean database via `cleanDatabase()` between test runs. This is already supported by the API test helpers — port this pattern to a `e2e/testUtils.ts` file.

---

## 7. Recommended File Structure

```
e2e/
  auth.spec.ts              ← NEW: sign in/up/out, cookie behavior
  photoCard.spec.ts         ← NEW: flip card hover + click
  homepage.spec.ts           ← UPDATE: extend existing
  upload.spec.ts             ← UPDATE: fix auth helper
  map.spec.ts                ← UPDATE: fix auth helper
  search.spec.ts             ← NEW
  photoDetail.spec.ts        ← NEW
  profile.spec.ts            ← NEW
  communities.spec.ts        ← NEW
  admin.spec.ts              ← NEW
  testUtils.ts               ← NEW: shared helpers (signIn, createTestUser, cleanDb)
```

---

## 8. Execution Plan

| Phase | Specs | Effort |
|---|---|---|
| **Phase 1** — Fix broken auth | `upload.spec.ts`, `map.spec.ts` | 1–2 hrs |
| **Phase 2** — Photo & feed | `photoCard.spec.ts`, extend `homepage.spec.ts` | 2–3 hrs |
| **Phase 3** — Core auth flows | `auth.spec.ts` (P0 tests) | 2 hrs |
| **Phase 4** — Detail & search | `photoDetail.spec.ts`, `search.spec.ts` | 2 hrs |
| **Phase 5** — Social features | `profile.spec.ts`, `communities.spec.ts` | 3 hrs |
| **Phase 6** — Admin | `admin.spec.ts` | 2 hrs |

**Total estimated: ~14–16 hrs of test writing**

CI should run full suite. In development, run `playwright test` or target specific specs with `playwright test auth.spec.ts`.
