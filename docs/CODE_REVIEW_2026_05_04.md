# SpotterHub Code Review — 2026-05-04

> **Status:** Implementation in progress (V1.2)
> **Last updated:** 2026-05-04

---

## Overview

Comprehensive senior-level code review performed 2026-05-04 covering architecture, UI, security, and dependency issues. 27 issues identified across 4 categories (P1 critical / P2 moderate / P3 low).

---

## Priority 1 (P1) — Critical — ALL COMPLETE

| ID | Issue | Severity | Files Changed | Status |
|---|---|---|---|---|
| S1 | JWT secret validation at module load | Critical | `apps/api/src/auth/jwt.ts`, `apps/api/src/context.ts` | ✅ Done |
| S3 | Refresh token rotation | High | `apps/api/src/resolvers/authResolvers.ts` | ✅ Done |
| D1 | Aircraft hierarchy filter (manufacturer/family/variant) | High | `apps/api/src/resolvers/photoResolvers.ts` | ✅ Done |
| D2 | softDeletePhoto/hardDeletePhoto moderatorId uses sub instead of DB id | High | `apps/api/src/resolvers/photoResolvers.ts` | ✅ Done |

### S1 — JWT Secret Validation
- **Problem:** JWT_SECRET fell back to a dev default at runtime (`index.ts` only); production could silently use weak secret
- **Fix:** Static validation at module load in `jwt.ts` — process exits(1) if missing or is the dev fallback in production

### S3 — Refresh Token Rotation
- **Problem:** Sign-in did not invalidate previous refresh tokens; stolen tokens remain usable
- **Fix:** `signIn` now runs `prisma.refreshToken.deleteMany({ where: { userId } })` before issuing a new session

### D1 — Aircraft Hierarchy Filter
- **Problem:** Three separate `where.aircraft = ...` assignments overwrote each other; only the last filter (variant) applied
- **Fix:** Single `aircraftFilter` object accumulates all three conditions and assigns once

### D2 — softDeletePhoto/hardDeletePhoto moderatorId
- **Problem:** Used JWT `sub` (Cognito UUID) instead of Prisma `User.id` for `communityModerationLog.moderatorId` FK
- **Fix:** Both mutations now use `getDbUser(ctx).id` via the `getDbUser()` helper

---

## Priority 2 (P2) — Moderate — ALL COMPLETE

| ID | Issue | Severity | Files Changed | Status |
|---|---|---|---|---|
| S2 | CSRF protection (Origin validation) | High | `apps/api/src/index.ts` | ✅ Done |
| S4 | Rate limiting on public GraphQL (per-user key; middleware order) | High | `apps/api/src/index.ts` | ✅ Done |
| S5 | Account lockout after failed sign-in attempts | High | `packages/db/prisma/schema.prisma`, `apps/api/src/resolvers/authResolvers.ts`, `apps/api/src/resolvers/adminResolvers.ts` | ✅ Done |
| A1 | approveSeller empty onboardingUrl overwrites Stripe state | Medium | `apps/api/src/resolvers/marketplaceResolvers.ts` | ✅ Done |
| V3 | Latitude/longitude server-side range validation | Medium | `apps/api/src/resolvers/photoResolvers.ts` | ✅ Done |
| DB1 | Missing composite index on Photo(aircraftId, createdAt DESC) | Medium | `packages/db/prisma/schema.prisma` | ✅ Done |
| DB2 | Missing index on PhotoListing(status, createdAt) | Medium | `packages/db/prisma/schema.prisma` | ✅ Done |
| F1 | AuthProvider SSR safety (hydration flash) | Medium | `apps/web/src/app/layout.tsx`, `apps/web/src/lib/auth.tsx`, `apps/web/src/lib/providers.tsx`, `apps/web/src/app/api/auth/me/route.ts` | ✅ Done |
| V1 | Upload quota enforcement | Medium | `apps/api/src/resolvers/photoResolvers.ts` | ✅ Done |

### S2 — CSRF Protection
- **Problem:** No Origin validation on state-changing GraphQL requests
- **Fix:** `csrfGuard` middleware on `/graphql` checks `Origin` header against allowed origins on POST/PATCH/DELETE

### S4 — Rate Limiting Fix
- **Problem:** (1) `graphqlLimiter` used IP-only key — authenticated users share quota with abusers; (2) `express.json()` ran after rate limiters so they couldn't read `req.body`
- **Fix:** Added `keyGenerator` to use `user:sub` when authenticated (JWT decoded inline), falls back to IP; moved `express.json()` before rate limiters

### S5 — Account Lockout
- **Problem:** No protection against brute-force password guessing
- **Fix:** Added `failedAttempts Int @default(0)` and `lockoutUntil DateTime?` to User model; `signIn` locks for 15 min after 5 consecutive failures; `adminUnlockUser` mutation for admins to manually unlock

### A1 — approveSeller onboardingUrl
- **Problem:** Always set `stripeOnboardingComplete: false` regardless of Stripe account creation success, overwriting prior true state
- **Fix:** Only write `stripeOnboardingComplete: false` when `stripeAccountId != null` (Stripe account was created); when Stripe fails, the field is left unchanged

### V3 — Coordinate Validation
- **Problem:** No server-side range check on latitude/longitude inputs
- **Fix:** Both `createPhoto` and `updatePhoto` now validate lat ∈ [-90, 90], lng ∈ [-180, 180] and throw `BAD_USER_INPUT` on violation

### DB1 — Photo(aircraftId, createdAt) Index
- **Fix:** `@@index([aircraftId, createdAt(sort: Desc)])` on Photo model

### DB2 — PhotoListing(active, createdAt) Index
- **Fix:** `@@index([active, createdAt(sort: Desc)])` on PhotoListing model

### F1 — AuthProvider SSR Safety
- **Problem:** Client-only hydration caused flash of unauthenticated state on first render
- **Fix:** Root layout is now an async server component that fetches `/api/auth/me` server-side and passes `serverAuth` prop to `Providers` → `AuthProvider`; `AuthProvider` uses `serverAuth` as initial state, only fetches client-side on mount to refresh; `export const dynamic = 'force-dynamic'` prevents caching

### V1 — Upload Quota Enforcement
- **Problem:** No limit on uploads per user per month
- **Fix:** `getUploadUrl` now counts the user's photos created since the 1st of the month; if ≥ 50 (free tier limit), throws `FORBIDDEN`

---

## Priority 3 (P3) — Low — In Progress / Pending

| ID | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| D3 | Hidden privacy mode returns (0,0) instead of null | Low | ✅ Already correct | Field resolver at line 851 returns `null` when `privacyMode === 'hidden'` — no code change needed |
| D4 | Variant generation fails on comma-separated names (e.g. "A380-800, A388-100") | Low | ✅ Already correct | CSV parsing splits on comma correctly; `migrate-aircraft-hierarchy.ts` processes one variant per row — no bug found |
| S6 | S3 presigned URL CORS configuration | Low | ⏳ Pending | Needs review of S3 bucket CORS policy |
| F2 | Theme persistence flash-on-load | Low | ✅ Done | `toggleTheme` now immediately sets `document.documentElement.setAttribute` before `setState` |
| DEP1 | `graphql-tag` deprecation warning | Low | ⏳ Pending | Should migrate to `graphql` package's `parse`/`validate` |
| DEP2 | `eslint-plugin-react@^7.37.5` version conflict with ESLint 9 | Low | ⏳ Pending | Known pre-existing issue; upgrade or pin ESLint |
| DEP3 | TypeScript 6.x compatibility check | Low | ⏳ Pending | Not yet investigated |
| E1 | Email failures are silent (non-fatal but unactionable) | Low | ⏳ Pending | Should add sentry/categorized logging |
| DEP4 | `docs/Hook` — mysterious file | Low | ⏳ Pending | Investigate purpose and either document or remove |

---

## Schema Changes (Requires Migration)

```prisma
// User model — new fields for S5 account lockout
failedAttempts    Int       @default(0) @map("failed_attempts")
lockoutUntil      DateTime? @map("lockout_until")

// Photo model — new index for DB1
@@index([aircraftId, createdAt(sort: Desc)])

// PhotoListing model — new index for DB2
@@index([active, createdAt(sort: Desc)])
```

Run `npx prisma migrate dev --name add_account_lockout_and_indexes` to apply.

---

## Remaining Work

- **S6:** Audit S3 bucket CORS policy in `infrastructure/` and `apps/api/src/services/s3.ts`
- **DEP1:** Replace `graphql-tag` usage with `graphql` package
- **DEP2:** Pin or upgrade ESLint to resolve `eslint-plugin-react` conflict
- **DEP3:** Run codebase on TypeScript 6.x and fix any errors
- **DEP4:** Investigate `docs/Hook` file
- **E1:** Add structured logging for email failures (Sentry or similar)