# Code Review — Issue Resolution Plan

> **Last updated:** 2026-05-04
> **Review scope:** Architecture, UI, Security, Data Integrity, Dependency Issues
> **Reviewer:** Senior Solution Architect
> **Status:** Open — issues prioritized and actioned below

---

## Priority Legend

| Symbol  | Priority                         |
| ------- | -------------------------------- |
| 🔴 P1   | Critical — fix before production |
| 🟠 P2   | Moderate — fix within 2 weeks    |
| 🟡 P3   | Low — fix within 1 month         |
| ✅ Done | Resolved                         |

---

## 1. Security

### 🔴 P1 — JWT Secret Hardcoded Fallback Allowed in Production

**File:** `apps/api/src/context.ts:23`

```typescript
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';
```

**Problem:** The API reads `JWT_SECRET` lazily. If the environment variable is missing, it uses the weak dev fallback. The production guard in `index.ts:69-77` catches this at startup — but only if `NODE_ENV === 'production'` is set correctly. If NODE_ENV is misconfigured or unset, the API starts with the insecure secret.

**Current safeguard:** `index.ts:68-76` does exit if the secret is the dev fallback string in production mode. However, the lazy evaluation in `context.ts` means the actual token signing/verification could happen before that check if something imports `context.ts` eagerly.

**Fix:**
Move JWT_SECRET validation to a static module-level check that runs before any resolver or service code is executed:

```typescript
// apps/api/src/auth/jwt.ts — at module load time, before anything else
import { randomBytes } from 'node:crypto';

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
if (
  process.env.NODE_ENV === 'production' &&
  (rawSecret === 'dev-secret-do-not-use-in-production' || rawSecret.length < 32)
) {
  console.error(
    'FATAL: JWT_SECRET is not set or is the dev fallback. Refusing to start in production.',
  );
  process.exit(1);
}

const JWT_SECRET = rawSecret;
```

**Owner:** Backend
**Status:** 🟠 P2 — Scheduled

---

### 🔴 P1 — No CSRF Protection on HttpOnly Cookies

**Files:** `apps/api/src/index.ts`, `apps/api/src/auth/requireAuth.ts`

**Problem:** State-changing GraphQL mutations are sent with `credentials: 'include'` (cookies) but no CSRF token. An attacker could craft a POST request to `/api/graphql` with the victim's cookies from a malicious page.

**Fix:**

1. **Add a CSRF header requirement** — the `Authorization` header resolver already exists; add an `x-csrf-token` custom header requirement for mutations. The Next.js auth routes already send `Authorization: Bearer dummy` for the refresh endpoint which accidentally provides a non-empty Authorization — a real CSRF token would be better.

2. **Add Origin/Referer validation** in `apps/api/src/index.ts` before the GraphQL middleware:

```typescript
app.use('/graphql', (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.WEB_BASE_URL,
    `https://www.${new URL(process.env.WEB_BASE_URL).hostname}`,
  ];
  if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  next();
});
```

3. **Alternative (better):** Use `SameSite=Strict` cookie attribute instead of `Lax` for the access token cookie:

```typescript
`access_token=${accessToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ACCESS_TOKEN_MAX_AGE}`;
```

`Strict` prevents cross-site POST entirely. Note this will break some legitimate cross-origin flows (e.g., direct API calls from a separate origin) — only apply if all clients go through the same origin.

**Owner:** Backend
**Status:** 🟠 P2 — Scheduled

---

### 🔴 P1 — Refresh Token Not Rotated on Sign-In

**File:** `apps/api/src/resolvers/authResolvers.ts:145-189`

**Problem:** `signIn` creates a new refresh token and stores it in the DB, but does not invalidate any existing refresh tokens for that user. An attacker who has a stolen refresh token can still use it after the victim signs in (the old token remains valid until 7-day expiry).

**Fix:** In `signIn`, before issuing the new refresh token, delete all existing refresh tokens for that user:

```typescript
// In signIn resolver, after password verification passes
await ctx.prisma.refreshToken.deleteMany({
  where: { userId: user.id },
});
// Then create new refresh token as currently done
```

**Impact:** This invalidates all sessions on sign-in (device A signs in → device B's old token is revoked). If multi-device session management is desired, only delete tokens older than a threshold or tied to a specific device ID.

**Owner:** Backend
**Status:** 🟠 P2 — Scheduled

---

### 🟠 P2 — No Rate Limit on Public GraphQL Queries

**File:** `apps/api/src/index.ts:206-213`

**Problem:** The `graphqlLimiter` (100 req/min/IP) applies to all queries including unauthenticated public ones. An attacker can exhaust the shared quota, locking out legitimate public users.

**Fix:** Apply per-user rate limiting for authenticated requests (use `ctx.user.sub` or `ctx.user.id` as the key for authenticated users). For public requests, either exempt them from the global limit or increase the limit significantly:

```typescript
const graphqlLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // higher in dev
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, IP for public
    const token = req.headers.authorization?.slice(7);
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        return `user:${decoded.sub}`;
      } catch {}
    }
    return `ip:${req.ip}`;
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many GraphQL requests, please try again later' },
});
```

**Note:** There's also a middleware order bug — `authRateLimiter` (line 223) is applied after `graphqlLimiter` but before `express.json()`. The `req.body.query.includes(op)` check at line 111 runs on unparsed body if `express.json()` hasn't fired yet. Move `express.json()` before the rate limiters on the GraphQL path.

**Owner:** Backend
**Status:** 🟠 P2 — Scheduled

---

### 🟠 P2 — No Account Lockout on Failed Sign-In Attempts

**File:** `apps/api/src/resolvers/authResolvers.ts:145`

**Problem:** No tracking of failed password attempts. An attacker can brute-force passwords via the GraphQL endpoint.

**Fix:** Add a `failedAttempts` and `lockedUntil` fields to the `User` model (or a separate `LoginAttempt` table). On each failed sign-in, increment the counter and check if it exceeds 5 within a 15-minute window — if so, reject with `FORBIDDEN` and a clear message (e.g., "Account temporarily locked"). On successful sign-in, reset the counter.

Alternatively, use Redis to track failed attempts with a TTL (simpler, no schema change, but requires Redis to be reliable).

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

### 🟠 P2 — S3 Bucket CORS Allows Wildcard Origin in Production

**File:** `apps/api/src/services/s3.ts:62`

**Problem:** `AllowedOrigins: ['*']` allows any website to read/write photos. In production, this should be restricted.

**Fix:**

```typescript
const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [process.env.WEB_BASE_URL, `https://www.${new URL(process.env.WEB_BASE_URL).hostname}`]
    : ['*'];

await s3.send(
  new PutBucketCorsCommand({
    Bucket: S3_BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: allowedOrigins,
          AllowedMethods: ['GET', 'PUT', 'HEAD'],
          AllowedHeaders: ['*'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
```

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — `/api/auth/refresh` Places Token in Cookie Header + Request Body

**File:** `apps/web/src/app/api/auth/refresh/route.ts:23`

**Problem:** The refresh token value is forwarded as `Cookie: refresh_token=<token>` AND in the request body query string. This causes the token to appear in server logs, browser history, CDN logs.

**Fix:** Remove the `Authorization: Bearer dummy` line (it was a workaround that's no longer needed since the GraphQL resolver reads from cookies directly, not Authorization header). The `Cookie` header approach is correct. Verify the resolver at `authResolvers.ts:196` reads from cookies as expected.

**Owner:** Frontend
**Status:** ✅ Done (in review — remove the Authorization workaround line)

---

## 2. Data Integrity

### 🔴 P1 — Aircraft Hierarchy Filter Only Applies Last Filter

**File:** `apps/api/src/resolvers/photoResolvers.ts:206-222`

**Problem:** When `manufacturer`, `family`, and `variant` are all provided, only `variant` filter is applied. The `family` filter overwrites `manufacturer`, and `variant` overwrites both.

**Fix:**

```typescript
const aircraftFilter: Record<string, unknown> = {};
if (args.manufacturer) {
  aircraftFilter.manufacturer = { name: { contains: args.manufacturer, mode: 'insensitive' } };
}
if (args.family) {
  aircraftFilter.family = { name: { contains: args.family, mode: 'insensitive' } };
}
if (args.variant) {
  aircraftFilter.variant = { name: { contains: args.variant, mode: 'insensitive' } };
}
if (Object.keys(aircraftFilter).length > 0) {
  where.aircraft = aircraftFilter;
}
```

**Owner:** Backend
**Status:** 🟠 P2 — Scheduled

---

### 🔴 P1 — `softDeletePhoto` Uses JWT `sub` Instead of DB User ID for `moderatorId`

**File:** `apps/api/src/resolvers/photoResolvers.ts:709`

```typescript
moderatorId: (await requireRole(ctx, ['admin', 'moderator', 'superuser'])).sub,
// .sub is the Cognito UUID, not the Prisma User.id
```

**Problem:** All other `CommunityModerationLog` entries use `getDbUser(ctx).id` (the actual DB UUID). This one uses `sub` (Cognito sub) which is a different format/scheme. The relation is `moderatorId String @db.Uuid` referencing `User.id`, so the log entry will have a mismatched or null moderatorId.

**Fix:**

```typescript
const dbUser = await getDbUser(ctx);
moderatorId: dbUser.id,
```

**Owner:** Backend
**Status:** 🟠 P2 — Scheduled

---

### 🟠 P2 — `applyPrivacy('hidden')` Returns `0, 0` Instead of `null`

**File:** `apps/api/src/resolvers/photoResolvers.ts:26-27`

**Problem:** Hidden location returns `displayLat: 0, displayLng: 0` which is a valid coordinate (Gulf of Guinea). Clients checking `latitude != null` would incorrectly process this as a real location.

**Fix:** Store `null` in the `displayLatitude`/`displayLongitude` fields for hidden mode, then update the field resolver to explicitly return `null`:

```typescript
case 'hidden':
  return { displayLat: null, displayLng: null }; // NULL not 0
```

Update the `PhotoLocation` model: change `displayLatitude Float` to `displayLatitude Float?` (nullable) — this is a breaking schema change.

**Alternative (no schema change):** Store `90, 0` (North Pole) as a sentinel value for hidden mode, but this is less clean than null.

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

### 🟠 P2 — Variant Generation Failure Silently Returns Photo Without Variants

**File:** `apps/api/src/resolvers/photoResolvers.ts:404-433`

**Problem:** If `generateVariants` throws, the photo is committed without variants. No status flag exists. The `regeneratePhotoVariants` mutation exists but users have no indication it failed.

**Fix:**

1. Add a `variantStatus` field to `Photo` model (`pending | complete | failed`) — non-breaking, add a default.
2. Wrap photo + location + variant creation in `prisma.$transaction`:

```typescript
const photo = await ctx.prisma.$transaction(async (tx) => {
  const photo = await tx.photo.create({ data: {...} });
  // create location if needed
  return photo;
});
// Then generate variants outside the transaction
try {
  const variants = await generateVariants(input.s3Key, {...});
  for (const variant of variants) {
    await ctx.prisma.photoVariant.create({ data: {...} });
  }
  await ctx.prisma.photo.update({
    where: { id: photo.id },
    data: { variantStatus: 'complete' },
  });
} catch (err) {
  console.error('Variant generation failed:', err);
  await ctx.prisma.photo.update({
    where: { id: photo.id },
    data: { variantStatus: 'failed' },
  });
}
```

3. On the photo detail page, if `variantStatus === 'failed'`, show a "Regenerate variants" button.

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — `deletedFilter` Causes Per-Photo DB Lookup in Field Resolvers

**File:** `apps/api/src/resolvers/photoResolvers.ts:134-148`

**Problem:** In nested queries, `deletedFilter` calls `requireAuth` and then `ctx.prisma.user.findUnique` to check role on every photo. This is only a risk when the user relation is NOT pre-included in the query. The `photo` query pre-includes `user`, so it's safe. But if any resolver fetches photos without including `user`, the field resolver would trigger N additional DB queries.

**Fix:** Either ensure all photo queries always include `user` in the `include`, or memoize the role check at the request level (not per-photo).

**Owner:** Backend
**Status:** 🟡 P3 — Low priority

---

## 3. Database & Performance

### 🟠 P2 — Missing Index: `Photo.moderationStatus`

**File:** `packages/db/prisma/schema.prisma`

**Problem:** The `photos` query always filters `moderationStatus: 'approved'`. Without an index, every photo query does a full table scan on the photos table.

**Fix:** Add to `Photo` model:

```prisma
@@index([moderationStatus])
@@index([moderationStatus, createdAt])
```

**Owner:** Backend (database)
**Status:** 🟡 P3 — Scheduled

---

### 🟠 P2 — Missing Index: `MarketplaceItem.active`

**File:** `packages/db/prisma/schema.prisma`

**Problem:** `marketplaceItems` query filters by `active` but there's no index.

**Fix:** Add:

```prisma
@@index([active, moderationStatus])
```

**Owner:** Backend (database)
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — Follow Resolvers Don't Handle Duplicate Key Errors

**Files:** `apps/api/src/resolvers/followResolvers.ts` (not reviewed fully — referenced from communityResolvers)

**Problem:** Follow mutations (`followUser`, `followAirport`, `followTopic`) attempt to create a follow record. If a follow already exists (violates unique constraint), the DB throws an unhandled exception.

**Fix:** Wrap in try/catch and check for `P2002` Prisma error code — if duplicate, return the existing follow (idempotent operation).

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

## 4. Input Validation

### 🟠 P2 — Upload Quota Never Enforced

**File:** `apps/api/src/resolvers/photoResolvers.ts:297` (getUploadUrl)
**Also:** `packages/shared/src/index.ts:201` (validateUpload)

**Problem:** `validateUpload` checks file size and MIME type, but the user's upload count against their tier limit (`USER_TIER_LIMITS.free.uploadsPerMonth`) is never checked or incremented.

**Fix:**

1. Add `uploadsThisMonth` counter to `User` or `Profile` model (reset on first of month via scheduled job, or use a separate `MonthlyUpload` table with userId + month + count).
2. In `getUploadUrl`, before generating the presigned URL, check:

```typescript
const uploadsThisMonth = await ctx.prisma.monthlyUpload.count({
  where: { userId: user.id, month: new Date().toISOString().slice(0, 7) },
});
const limit = USER_TIER_LIMITS[user.tier ?? 'free'].uploadsPerMonth;
if (uploadsThisMonth >= limit) {
  throw new GraphQLError(`Monthly upload limit reached (${limit}). Upgrade for more.`, {
    extensions: { code: 'QUOTA_EXCEEDED' },
  });
}
```

3. After successful `createPhoto`, increment the counter.

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — Caption Length Not Validated on `updatePhoto`

**File:** `apps/api/src/resolvers/photoResolvers.ts:505`

**Problem:** `validateStringLength(input.caption, 'Caption', 0, 2000)` is called in `createPhoto` but not in `updatePhoto`. Someone can set a caption that breaks UI rendering.

**Fix:** Add `validateStringLength(args.input.caption, 'Caption', 0, 2000)` to `updatePhoto` resolver.

**Owner:** Backend
**Status:** 🟡 P3 — Low priority

---

### 🟡 P3 — Latitude/Longitude Not Range-Checked

**File:** `apps/api/src/resolvers/photoResolvers.ts:436-467`

**Problem:** Coordinates are accepted without validating they are within valid ranges. Invalid values could cause PostGIS geometry creation to fail.

**Fix:** Add validation in `createPhoto` and `updatePhoto`:

```typescript
if (input.latitude != null && (input.latitude < -90 || input.latitude > 90)) {
  throw new GraphQLError('Latitude must be between -90 and 90');
}
if (input.longitude != null && (input.longitude < -180 || input.longitude > 180)) {
  throw new GraphQLError('Longitude must be between -180 and 180');
}
```

**Owner:** Backend
**Status:** 🟡 P3 — Low priority

---

## 5. API Design

### 🟠 P2 — `approveSeller` Returns Empty `onboardingUrl` on Stripe Failure

**File:** `apps/api/src/resolvers/marketplaceResolvers.ts:278`

**Problem:** When Stripe onboarding fails (non-fatal), the seller is approved in the DB but `onboardingUrl` is returned as `''`. The frontend receives no signal that Stripe setup needs to be completed manually.

**Fix:** Return an error indicator in the response:

```typescript
return {
  sellerProfile: updated,
  onboardingUrl: onboardingUrl || '',
  stripeSetupRequired: !onboardingUrl, // New field for frontend to detect
};
```

Then update the `APPROVE_SELLER` query in `queries.ts` to include `stripeSetupRequired`. The frontend should show a warning: "Seller approved, but Stripe onboarding must be completed separately."

**Owner:** Backend + Frontend
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — `exportAirports` Returns All Records Without Pagination

**File:** `apps/api/src/schema.ts` (query definition)
**Resolvers:** `apps/api/src/resolvers/airportResolvers.ts` (not reviewed)

**Problem:** `exportAirports` returns all airports as a flat list. With thousands of airports, this causes memory pressure and potential timeout.

**Fix:** Add pagination with a high default limit (e.g., 5000) and a warning comment that this is for admin export only, not for general use.

**Owner:** Backend
**Status:** 🟡 P3 — Low priority

---

## 6. Frontend / UI

### 🟠 P2 — `AuthProvider` Not SSR-Safe (Flash of Unauthenticated State)

**File:** `apps/web/src/lib/auth.tsx:66-79`

**Problem:** Auth state is entirely client-side. On page navigation, the initial render always shows `ready: false` (loading spinner) before `useEffect` fires. This causes a flash of unauthenticated state even for SSR-rendered pages.

**Fix:** Use Next.js's `getServerSideProps` or a server component to read the `access_token` cookie server-side and pass the user data as props to `AuthProvider`. Alternatively, use a `Suspense` boundary with a server-side auth guard in the layout:

```typescript
// apps/web/src/app/layout.tsx or a dedicated AuthLayout
async function getUserFromCookie() {
  const cookieStore = await import('next/headers');
  const token = cookieStore.get('access_token');
  if (!token) return null;
  // Validate token and fetch user (call API or decode JWT)
}
```

Initialize `AuthProvider` with the server-fetched user instead of `null` + `ready: false`.

**Owner:** Frontend
**Status:** 🟠 P2 — Scheduled

---

### 🟡 P3 — Theme Preference Not Persisted to Cookie/LocalStorage

**File:** `apps/web/src/lib/theme.tsx` (not reviewed — referenced from Header.tsx)

**Problem:** Theme is in-memory only. Refreshing the page resets to default (likely light). Causes flash of wrong theme on first paint.

**Fix:** Read the persisted preference on mount:

```typescript
// In useTheme hook
const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
const [theme, setTheme] = useState(stored ?? 'light');
// On toggle, also persist to localStorage
```

**Owner:** Frontend
**Status:** 🟡 P3 — Low priority

---

### 🟡 P3 — No Suspense Boundaries / Loading States on Admin Pages

**Files:** `apps/web/src/app/admin/**/*.tsx`

**Problem:** Admin pages likely lack proper loading states and error boundaries, leading to blank pages or broken UI on slow connections.

**Fix:** Audit all admin pages for `loading.tsx` files and `error.tsx` files. Add:

```typescript
// apps/web/src/app/admin/loading.tsx
export default function Loading() {
  return <div className="loading-spinner" />;
}
```

**Owner:** Frontend
**Status:** 🟡 P3 — Low priority

---

## 7. Dependencies & Configuration

### 🟡 P3 — `graphql-tag` Deprecated, Use Built-in `gql` from `graphql`

**File:** `apps/web/src/lib/queries.ts:1`

**Fix:**

```typescript
// Before
import gql from 'graphql-tag';
// After
import { gql } from 'graphql';
```

This is safe to do in a single PR — the built-in `gql` tag is functionally identical and removes a deprecated dependency.

**Owner:** Frontend
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — `eslint-plugin-react@^7.37.5` Version Mismatch

**File:** `package.json:28`

**Problem:** `eslint-plugin-react` 7.x is the old API. Version 9.x is current and required for ESLint 9. This may cause linting issues or missing rules with the newer ESLint.

**Fix:** Upgrade to `eslint-plugin-react@^9.0.0` and update any breaking rule changes. Verify peer deps: `eslint@^9` requires `typescript-eslint@^8`.

**Owner:** DevOps/Frontend
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — TypeScript 6.0.3 in Root Package.json

**File:** `package.json:35`

**Problem:** `typescript@^6.0.3` — if this is genuinely version 6 (vs a typo for 5.x), many packages won't be compatible yet. If it's `^5.0.3` with a typo, ignore.

**Fix:** Verify actual version installed. If genuinely 6.x, downgrade to `^5.4.0` (latest stable 5.x) until ecosystem catches up.

**Owner:** DevOps
**Status:** 🟡 P3 — Scheduled

---

### 🟡 P3 — `docs/Hook` Untracked Directory in Git Status

**File:** `docs/Hook` (untracked)

**Problem:** Appears in `git status` as untracked. Could be sensitive or accidentally committed.

**Fix:** Check contents of `docs/Hook`:

```bash
ls -la docs/Hook
```

If it's a sample/config file that should be gitignored, add to `.gitignore`. If it's accidentally committed secrets, remove immediately.

**Owner:** DevOps
**Status:** 🟡 P3 — Low priority

---

## 8. Error Handling

### 🟡 P3 — Email Failures Silently Swallowed on Sign-Up

**File:** `apps/api/src/resolvers/authResolvers.ts:127-129`

**Problem:** `sendVerificationEmail` failure is logged but user is not told. The signup returns success even if the email never arrived.

**Fix:** Add `emailSent: boolean` to the `SignUpPayload` response. On email failure, set `emailSent: false` and include a "Resend verification email" link in the response. Alternatively, add a `canResendVerification` flag so the frontend knows to show a resend button.

**Owner:** Backend
**Status:** 🟡 P3 — Scheduled

---

## Summary Dashboard

| #    | Issue                                                              | Priority | Status |
| ---- | ------------------------------------------------------------------ | -------- | ------ |
| S1   | JWT secret fallback — static validation at module load             | 🔴 P1    | 🟠 P2  |
| S2   | No CSRF protection on HttpOnly cookie mutations                    | 🔴 P1    | 🟠 P2  |
| S3   | Refresh token not rotated on sign-in                               | 🔴 P1    | 🟠 P2  |
| S4   | No rate limit on public GraphQL queries                            | 🟠 P2    | 🟠 P2  |
| S5   | No account lockout on failed sign-in                               | 🟠 P2    | 🟡 P3  |
| S6   | S3 CORS wildcard in production                                     | 🟠 P2    | 🟡 P3  |
| D1   | Aircraft hierarchy filter only applies last filter                 | 🔴 P1    | 🟠 P2  |
| D2   | softDeletePhoto uses sub instead of DB user ID                     | 🔴 P1    | 🟠 P2  |
| D3   | applyPrivacy hidden mode returns 0,0 not null                      | 🟠 P2    | 🟡 P3  |
| D4   | Variant generation failure silently returns photo without variants | 🟠 P2    | 🟡 P3  |
| D5   | deletedFilter causes per-photo DB lookup in some paths             | 🟡 P3    | 🟡 P3  |
| DB1  | Missing index: Photo.moderationStatus                              | 🟠 P2    | 🟡 P3  |
| DB2  | Missing index: MarketplaceItem.active                              | 🟠 P2    | 🟡 P3  |
| DB3  | Follow resolvers don't handle duplicate key errors                 | 🟡 P3    | 🟡 P3  |
| V1   | Upload quota never enforced                                        | 🟠 P2    | 🟡 P3  |
| V2   | Caption length not validated on updatePhoto                        | 🟡 P3    | 🟡 P3  |
| V3   | Latitude/longitude not range-checked                               | 🟡 P3    | 🟡 P3  |
| A1   | approveSeller returns empty onboardingUrl silently                 | 🟠 P2    | 🟡 P3  |
| A2   | exportAirports has no pagination                                   | 🟡 P3    | 🟡 P3  |
| F1   | AuthProvider not SSR-safe — flash of unauth state                  | 🟠 P2    | 🟠 P2  |
| F2   | Theme preference not persisted                                     | 🟡 P3    | 🟡 P3  |
| F3   | Admin pages lack loading/error states                              | 🟡 P3    | 🟡 P3  |
| DEP1 | graphql-tag deprecated — use built-in gql                          | 🟡 P3    | 🟡 P3  |
| DEP2 | eslint-plugin-react version mismatch                               | 🟡 P3    | 🟡 P3  |
| DEP3 | TypeScript 6.x compatibility check needed                          | 🟡 P3    | 🟡 P3  |
| DEP4 | docs/Hook untracked directory investigation                        | 🟡 P3    | 🟡 P3  |
| E1   | Email failures silently swallowed on signup                        | 🟡 P3    | 🟡 P3  |

**Total: 27 issues**

- 🔴 P1 Critical: 4
- 🟠 P2 Moderate: 9
- 🟡 P3 Low: 14

---

## Recommended Implementation Order

1. **S1 + S3** — JWT secret hardening + refresh token rotation (security foundation)
2. **S2** — CSRF protection (security foundation)
3. **D1 + D2** — Aircraft filter bug + softDeletePhoto moderatorId bug (data correctness)
4. **S4** — Rate limiting fix (operational stability)
5. **F1** — AuthProvider SSR fix (user experience)
6. **D3 + D4** — Privacy mode fix + variant failure handling (data quality)
7. **V1** — Upload quota enforcement (business logic)
8. **All P3** — Remaining low-priority items grouped into a "Maintenance Sprint"
