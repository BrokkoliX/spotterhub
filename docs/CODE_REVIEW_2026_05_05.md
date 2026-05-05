# SpotterHub Comprehensive Code Review

**Date:** 2026-05-05
**Reviewer:** Automated deep review
**Scope:** Full monorepo — API, Web, Database, Infrastructure, CI/CD, Testing

**Session 2026-05-05 Fixes Applied:**
- C2: User email exposed via GraphQL field resolver
- C3: Raw GPS stored when privacy hidden (nulled in createPhoto/updatePhoto)
- C4: Lambda JWT fallback secret
- C5: S3 CORS all origins in production
- C6: No password reset token cleanup
- H1: Lat/lng validation after photo creation
- H3: No per-email rate limit on password reset
- H4: Comment replies not paginated (take: 50)
- H5: `users` query unauthenticated
- H6: `airports` query unpaginated (cursor pagination added)
- H12: softDelete/hardDeleteComment wrong moderatorId (cognitoSub → DB id)
- M10: signOut only cleared current token (now clears all user sessions)

---

## Executive Summary

SpotterHub is a well-structured Turborepo monorepo with solid foundations: proper auth with token rotation, DataLoader batching, cursor-based pagination, and sensible separation of concerns. However, the review identified **6 Critical**, **14 High**, **18 Medium**, and **13 Low** severity issues across security, architecture, scalability, and code quality.

---

## 🔴 CRITICAL Issues — ALL COMPLETE

### C1. `issueSession` overwrites `Set-Cookie` header — only last cookie is sent
**File:** `apps/api/src/resolvers/authResolvers.ts:55-66`  
**Impact:** Two separate `res.setHeader('Set-Cookie', [...])` calls overwrite each other. Only the `refresh_token` cookie is actually set; the `access_token` cookie is lost. This breaks the dual-cookie auth flow entirely.  
**Fix:** Combine into a single `setHeader` call with both cookies in the array.

### C2. User email exposed to all users via GraphQL `User` type
**File:** `apps/api/src/schema.ts` (User type) + `apps/api/src/resolvers/userResolvers.ts`  
**Impact:** The `User` type includes `email: String!` which is returned for any `user(username:)` query. Any unauthenticated user can enumerate emails of all users — a major privacy violation and enables credential stuffing/phishing.  
**Fix:** Remove `email` from the public `User` type or add a field resolver that only returns it if `ctx.user.sub === parent.cognitoSub`.

### C3. Raw GPS coordinates stored and accessible to admin/moderator users
**File:** `apps/api/src/resolvers/photoResolvers.ts:481-482`, `packages/db/prisma/schema.prisma` (PhotoLocation model)
**Impact:** `rawLatitude` and `rawLongitude` are stored even when privacy mode is `hidden` or `approximate`. While the display field resolver filters these, any direct DB access (admin tools, future API changes) could leak exact user locations.
**Fix:** ✅ Done — `rawLatitude`/`rawLongitude` are now set to `null` when `privacyMode === 'hidden'` in both `createPhoto` and `updatePhoto`.

### C4. Lambda handler uses hardcoded JWT fallback secret in production
**File:** `apps/api/src/lambda.ts:104`
**Fix:** ✅ Done — throws error if `JWT_SECRET` is not set after `ensureInitialized()`.

### C5. S3 CORS allows all origins (`*`) in production
**File:** `apps/api/src/services/s3.ts:57-63`
**Fix:** ✅ Done — `AllowedOrigins` restricted to `WEB_BASE_URL` in production, `['*']` only in dev.

### C6. No expired password reset token cleanup — unbounded DB growth
**File:** `apps/api/src/resolvers/authResolvers.ts`
**Fix:** ✅ Done — `resetPassword` now deletes all `PasswordResetToken` records for the user after successful use.

---

## 🟠 HIGH Issues — Partial

| ID | Issue | Status |
|---|---|---|
| H1 | Lat/lng validation after photo creation | ✅ Done |
| H2 | Like count denormalization race condition | ⚠️ Acceptable risk — field resolver uses DataLoader (correct); column used only for sort |
| H3 | No per-email rate limit on password reset | ✅ Done |
| H4 | Comment replies not paginated | ✅ Done |
| H5 | `users` query unauthenticated | ✅ Done |
| H6 | `airports` query unpaginated | ✅ Done |
| H7 | Notification IDOR | ✅ Already correct |
| H8 | `searchPhotos` LIKE without full-text index | ⏳ Pending — needs DB migration for GIN trigram |
| H9 | Hardcoded AWS IDs in CDK | ⏳ Pending |
| H10 | Long-lived AWS access keys in deploy.yml | ⏳ Pending |
| H11 | No HTTP-to-HTTPS redirect on ALB | ⏳ Pending |
| H12 | `softDeleteComment`/`hardDeleteComment` wrong moderatorId | ✅ Done |
| H13 | No CI test gate before deploy | ⏳ Pending |
| H14 | Docker `:latest` tag | ⏳ Pending |

---

## 🟡 MEDIUM Issues

### M1. `schema.ts` is a 3,500+ line monolith
**File:** `apps/api/src/schema.ts`  
**Impact:** Difficult to navigate, review, and maintain. Finding a specific type or input requires extensive scrolling.  
**Fix:** Split into modular `.graphql` files per domain (auth, photo, community, etc.) and merge at build time.

### M2. No input sanitization on HTML-renderable fields
**Files:** Photo `caption`, Comment `body`, Community `description`, Forum `body`  
**Impact:** While GraphQL responses are typically consumed as JSON (not rendered as HTML), if any client renders these as HTML (e.g., markdown), stored XSS is possible.  
**Fix:** Sanitize or escape user input at the API layer for fields that might be rendered.

### M3. `deletePhoto` does not clean up S3 objects
**File:** `apps/api/src/resolvers/photoResolvers.ts:418-437`  
**Impact:** When a photo is deleted, the DB record is removed but the S3 objects (original + variants) remain, consuming storage indefinitely.  
**Fix:** Delete S3 objects before or after DB deletion, or implement a background cleanup job.

### M4. Missing database indexes on frequently queried columns
**File:** `packages/db/prisma/schema.prisma`  
**Impact:** Several columns used in WHERE clauses lack indexes:
- `Photo.userId` — used in most photo queries
- `Photo.moderationStatus` — filtered on every public query
- `Photo.airportCode` — used for airport-based photo filtering
- `Comment.photoId` — used to fetch comments for a photo
- `Like.photoId` — used in DataLoader count queries
- `Report.status` — used in admin queries
**Fix:** Add `@@index` directives to the schema.

### M5. `photos` query totalCount is always computed
**File:** `apps/api/src/resolvers/photoResolvers.ts:230-232`  
**Impact:** Every paginated `photos` query runs both a `findMany` and a `count` query. The count query re-evaluates the same complex filter, doubling DB load.  
**Fix:** Consider making `totalCount` optional or computing it only when requested (via `@defer` or conditional resolution).

### M6. Variant generation blocks photo creation response
**File:** `apps/api/src/resolvers/photoResolvers.ts:413-445`  
**Impact:** Image processing (thumbnail, display, watermark generation) runs synchronously during the `createPhoto` mutation. For large images, this can take 10-30 seconds, causing timeouts.  
**Fix:** Move variant generation to a background job queue (SQS + Lambda, or BullMQ).

### M7. GraphQL introspection disabled check only on Express, not Lambda
**File:** `apps/api/src/lambda.ts:55`  
**Impact:** The Lambda handler creates a separate ApolloServer instance with the same introspection check, but it reads `NODE_ENV` which may not be set in Lambda environment. If missing, introspection could be enabled in production.  
**Fix:** Explicitly set `NODE_ENV=production` in Lambda environment variables and verify.

### M8. No password complexity requirements beyond length
**File:** `apps/api/src/resolvers/authResolvers.ts:84-88`  
**Impact:** Only checks `password.length < 8`. Users can use weak passwords like "12345678" or "aaaaaaaa".  
**Fix:** Add complexity requirements (uppercase, lowercase, number, special character) or use a password strength library like `zxcvbn`.

### M9. `ExperienceLevel` enum in Prisma not enforced in API
**File:** `packages/db/prisma/schema.prisma` defines `ExperienceLevel` enum, but `apps/api/src/resolvers/profileResolvers.ts` doesn't validate input.  
**Impact:** Invalid experience level values could be stored if Prisma's enum validation is bypassed.  
**Fix:** Validate `experienceLevel` against the enum values in the resolver.

### M10. `signOut` doesn't clear ALL refresh tokens for the user
**File:** `apps/api/src/resolvers/authResolvers.ts:273-278`  
**Impact:** `signOut` only deletes the specific refresh token from the cookie. If a user has multiple active sessions, the other sessions remain valid. This is inconsistent with `signIn`, which deletes ALL refresh tokens.  
**Fix:** Delete all refresh tokens for the user on sign-out (same as sign-in behavior) or clarify the intended behavior.

### M11. Community moderation logs use `communityId: 'global'` for site-wide actions
**File:** `apps/api/src/resolvers/photoResolvers.ts:379, commentResolvers.ts:262`  
**Impact:** The `CommunityModerationLog` table has a FK to `Community(id)`. Using `'global'` as communityId requires a Community record with ID 'global' to exist, otherwise the insert fails with FK violation.  
**Fix:** Make `communityId` nullable for site-wide moderation actions, or create a separate `SiteModerationLog` table.

### M12. No webhook idempotency for Stripe events
**File:** `apps/api/src/index.ts:184-216`  
**Impact:** If Stripe retries a webhook event, the handler processes it again. For `checkout.session.completed`, this could attempt to update an order that's already completed, or worse, mark a listing as inactive twice.  
**Fix:** Check if the order is already in the target state before updating, or use Stripe event IDs for idempotency.

### M13. Frontend auth uses polling (`/api/auth/me`) without proper error handling
**File:** `apps/web/src/lib/auth.tsx:77-93`  
**Impact:** The background revalidation fetch to `/api/auth/me` can fail silently, leaving stale user state. No retry logic exists.  
**Fix:** Add retry with exponential backoff, or use `SWR`/`react-query` for automatic revalidation.

### M14. Docker compose uses version `3.9` (deprecated)
**File:** `docker/docker-compose.yml:1`  
**Impact:** The `version` key is deprecated in modern Docker Compose. While not breaking, it's unnecessary noise.  
**Fix:** Remove the `version` key.

### M15. `ForumCategory.slug` is not globally unique — only unique per community
**File:** `packages/db/prisma/schema.prisma` — `@@unique([communityId, slug])`  
**Impact:** Global forum categories (where `communityId` is null) could have slug collisions since `null != null` in SQL unique constraints.  
**Fix:** Add a partial unique index for global categories: `@@unique([slug])` where `communityId IS NULL`.

### M16. No request body size limits on Express routes
**File:** `apps/api/src/index.ts`  
**Impact:** `express.json()` defaults to 100kb but `express.raw()` on the Stripe webhook has no explicit limit. Very large payloads could consume memory.  
**Fix:** Set explicit body size limits: `express.json({ limit: '1mb' })`.

### M17. `searchAirlines` queries the `Photo` table for distinct airlines
**File:** `apps/api/src/resolvers/searchResolvers.ts:89-103`  
**Impact:** Airline search scans the entire `photos` table for distinct `airline` values. This is O(n) on photos when there's a dedicated `airlines` table available.  
**Fix:** Query the `Airline` model directly instead of scanning photos.

### M18. Missing validation on `followTopic` targetType
**File:** `apps/api/src/schema.ts` — `followTopic(targetType: String!, value: String!)`  
**Impact:** `targetType` is a plain `String!` instead of the `FollowTargetType` enum, allowing arbitrary values.  
**Fix:** Change the parameter type to `FollowTargetType!`.

---

## 🟢 LOW Issues

### L1. Duplicate `deletedFilter` helper across resolvers
**Files:** `photoResolvers.ts:121-136`, `commentResolvers.ts:38-53`  
**Impact:** Code duplication. Both implementations are identical.  
**Fix:** Extract to a shared utility in `utils/resolverHelpers.ts`.

### L2. `resolverValidationOptions: { requireResolversToMatchSchema: 'ignore' }`
**File:** `apps/api/src/index.ts:72`  
**Impact:** This silences warnings when resolvers don't match schema fields. Missing resolver implementations will silently return null instead of erroring during development.  
**Fix:** Set to `'warn'` during development or remove the option.

### L3. `parseGpsFromExif` always returns null
**File:** `apps/api/src/services/imageProcessing.ts:266-272`  
**Impact:** The EXIF GPS extraction is a stub that never extracts GPS data. EXIF coordinates are silently lost.  
**Fix:** Implement using the `exifr` package as noted in the comment.

### L4. Auth rate limiter is overly permissive (5000 requests/15 min)
**File:** `apps/api/src/index.ts:82-83`  
**Impact:** The comment says "upsert-heavy admin imports" justify 5000 req/15min, but this rate limit also covers `signin`, `signup`, and `resetpassword`. This effectively disables rate limiting for auth operations.  
**Fix:** Split into separate rate limiters: a strict one for auth (20 req/15min per IP) and a permissive one for admin imports.

### L5. `any` types used extensively in loaders and image processing
**Files:** `apps/api/src/loaders.ts:13`, `apps/api/src/services/imageProcessing.ts:7`  
**Impact:** Loss of type safety. The `photoLocation` and `aircraftById` loaders return `any`, hiding potential runtime errors.  
**Fix:** Use proper Prisma-generated types for loader return values.

### L6. Missing `.env` file — only `.env.example` exists
**File:** Root directory  
**Impact:** New developers must manually copy `.env.example` to `.env` and may miss this step, causing confusing startup errors.  
**Fix:** Add a setup script or document the step prominently in README.

### L7. No Prisma migration lock / safety checks
**File:** `packages/db/prisma/`  
**Impact:** Multiple developers running `prisma migrate dev` concurrently could cause migration conflicts.  
**Fix:** Use Prisma's migration advisory lock (default in recent versions) and document the migration workflow.

### L8. `CommunityModerationLog.communityId` uses `@db.Uuid` but `'global'` is not a UUID
**File:** `packages/db/prisma/schema.prisma`  
**Impact:** Storing `'global'` in a UUID column will fail at the DB level (PostgreSQL UUID type validation).  
**Fix:** Make `communityId` nullable or use a proper system UUID value.

### L9. Inconsistent cursor encoding — some cursors use `createdAt`, others use `id`
**Files:** `photoResolvers.ts:557` uses `p.id` as cursor; most others use `encodeCursor(item.createdAt)`  
**Impact:** Inconsistent API behavior. Using `createdAt` as cursor can have collisions when items share the same timestamp.  
**Fix:** Standardize on ID-based cursors or composite `(createdAt, id)` cursors.

### L10. Redis is in `docker-compose.yml` but not used by the application
**File:** `docker/docker-compose.yml:18-24`  
**Impact:** Unused infrastructure consumes developer machine resources.  
**Fix:** Remove until Redis is actually integrated (for caching, rate limiting, or pub/sub).

### L11. CloudFront origins don't specify protocol — defaults to HTTP
**File:** `infrastructure/lib/spotterspace-stack.ts:213-231`  
**Impact:** CloudFront communicates with ALB over HTTP by default. While within VPC this is somewhat acceptable, HTTPS to origin is best practice.  
**Fix:** Add `originProtocolPolicy: 'https-only'` to origin configuration.

### L12. `AlbumPhoto` join table exists alongside direct `Photo.albumId` FK
**File:** `packages/db/prisma/schema.prisma`  
**Impact:** A photo can be linked to an album via `Photo.albumId` (one-to-one) AND via `AlbumPhoto` join table (many-to-many). This dual relationship creates ambiguity about which is canonical.  
**Fix:** Deprecate `Photo.albumId` in favor of the `AlbumPhoto` join table, or vice versa.

### L13. Cookie `Secure` flag set unconditionally — local dev DX issue
**File:** `apps/api/src/resolvers/authResolvers.ts:60-65`  
**Impact:** Cookies with `Secure` flag are only sent over HTTPS. In local dev (HTTP), the browser will silently refuse to store/send these cookies. **Production is unaffected** (HTTPS is required). This only impacts local development experience.  
**Fix:** Conditionally omit `Secure` when `NODE_ENV !== 'production'`.

---

## Architecture Observations

### Positives
- ✅ **DataLoader pattern** properly implemented with per-request instances (no cache leaks)
- ✅ **Cursor-based pagination** with consistent `first`/`after` pattern across all list queries
- ✅ **Token rotation** on refresh with database-backed refresh tokens
- ✅ **Account lockout** with exponential backoff on failed sign-in attempts
- ✅ **Soft-delete pattern** with moderation logging for admin actions
- ✅ **Input validation** helpers (`validateStringLength`, `validateArrayLength`, `validateUpload`)
- ✅ **CSRF guard** via Origin header verification
- ✅ **Monorepo structure** with shared packages (`@spotterspace/db`, `@spotterspace/shared`)
- ✅ **Email HTML escaping** in email templates to prevent injection
- ✅ **Production JWT secret validation** — refuses to start with dev fallback

### Recommendations
1. **Add a background job system** (BullMQ, SQS) for image processing, notification delivery, cleanup jobs
2. **Implement full-text search** with PostgreSQL `tsvector` or external search service
3. **Add security headers** (CSP, X-Frame-Options, X-Content-Type-Options) via Express middleware
4. **Set up monitoring/alerting** — no APM or error tracking (Sentry, Datadog) is configured
5. **Add database connection pooling** — Prisma defaults may not scale under load (consider PgBouncer)
6. **Consider GraphQL query complexity/depth limiting** to prevent expensive nested queries
7. **Add audit logging** for sensitive admin operations beyond community moderation

---

*Generated from automated analysis of the SpotterHub monorepo.*
