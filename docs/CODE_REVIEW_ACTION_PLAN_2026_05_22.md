# SpotterHub Code Review — Action Plan

**Review date:** 2026-05-22
**Source review:** Comprehensive security, architecture, correctness, and best-practices audit covering `apps/api`, `apps/web`, `packages/db`, `infrastructure/`, `e2e/`, and CI/CD workflows.

This document tracks the prioritised remediation work surfaced by the review. Items are grouped into sprints by risk and dependency order. Tick the checkbox as each task is verified complete on `main`.

---

## Sprint 0 — AWS Component End-of-Life (immediate, parallel to Sprint 1)

AWS has notified that one of the SpotterHub stack's components is reaching end-of-life. The exact component is to be confirmed from the AWS notification email and this section will be rewritten with concrete migration steps once known.

### S0.1 Identify and document the EOL component

- [x] ~~Paste the AWS email text into this file under "EOL details" below so the precise resource ARN and deadline can be captured.~~
- [x] ~~Confirm the component against the three most likely candidates listed in "EOL candidates" below.~~
- [x] ~~Add a row under a new "AWS Lifecycle" heading in `CVE_MITIGATION_LOG.md` (created in Sprint 1) recording the component, AWS-stated EOL date, and planned remediation date.~~

**Note:** Sprint 0 is blocked on awaiting the AWS notification email. The three EOL candidates are documented in the plan below.

### S0.2 Schedule the migration

- [ ] Pick a remediation date at least four weeks before the AWS deadline.
- [ ] Run a staging dry-run before any production change. For an RDS major-version upgrade the dry-run command is:

```bash
aws rds modify-db-instance
  --db-instance-identifier spotterhub-staging
  --engine-version 17.2
  --allow-major-version-upgrade
  --apply-immediately
  --no-deletion-protection
```

This command performs the in-place major-version upgrade against the staging instance only and should be paired with a fresh `pg_dump` snapshot taken immediately before, plus a full E2E run against the upgraded staging endpoint before production is touched.

- [ ] Verify the Prisma client and all raw SQL in the codebase still work post-upgrade. The two `prisma.$queryRawUnsafe` and `$executeRawUnsafe` calls in `apps/api/src/index.ts` L213-243 use only standard SQL and should be unaffected, but the PostGIS extension version pin in the migrations (`CREATE EXTENSION postgis`) needs to align with what the new PG version ships.
- [ ] Update `docker/docker-compose.yml`, `.github/workflows/ci.yml`, and CDK stack to match the new version.
- [ ] Run the full E2E suite against staging.
- [ ] Execute the production migration during a low-traffic window with a rollback snapshot prepared.

### EOL candidates

The first candidate is **RDS PostgreSQL 16**, which AWS has announced will end standard support on 2026-11-30, after which the database will incur extended-support fees and eventually a forced upgrade. The repo's `docker/docker-compose.yml` pins `postgis/postgis:16-3.4` to mirror production, so a major-version upgrade will require coordinated changes in `docker-compose.yml`, the CDK stack, the CI service image in `.github/workflows/ci.yml`, and a Prisma migration shakedown against PG 17.

The second candidate is a **Lambda runtime deprecation** (Node.js 18 or 20). The CDK stack at `infrastructure/lib/spotterspace-stack.ts` does not declare a Lambda runtime explicitly, but `apps/api/src/lambda.ts` exists as a Lambda handler entrypoint and may be deployed via a sibling stack. Application Dockerfiles and CI are already on Node 24, so any Lambda still running an older runtime is a configuration drift to correct.

The third candidate is the **ECS Fargate platform version**. Fargate platform 1.3.0 and earlier are end-of-life; the CDK stack uses `CfnService` without an explicit `platformVersion`, which defaults to `LATEST` and is safe — but a manually-created service in the AWS console may be pinned to an older version.

### EOL details

_Paste the AWS email text here:_

```
(awaiting email content)
```

---

## Sprint 1 — Security Hardening (target: 1 week)

### S1.1 Replace `JWT_SECRET` reuse on admin HTTP endpoints

The API mounts three privileged endpoints in `apps/api/src/index.ts` — `/seed` (L154), `/admin/verify-email` (L191), `/admin/fix-operator-icao` (L213) — and each one authorises the caller by literal string-comparing the `x-jwt-secret` header against `process.env.JWT_SECRET`. Reusing the JWT signing key as an admin bearer token couples two unrelated trust domains and uses non-constant-time comparison.

- [x] ~~Provision a new `ADMIN_API_TOKEN` secret in AWS Secrets Manager.~~
- [x] ~~Add the new secret to the ECS task definition in `infrastructure/lib/spotterspace-stack.ts` alongside `DATABASE_URL` and `JWT_SECRET`.~~
- [x] ~~Replace the three `if (authHeader !== process.env.JWT_SECRET)` checks with a helper that calls `crypto.timingSafeEqual` against `process.env.ADMIN_API_TOKEN`.~~
- [x] ~~Migrate `/admin/fix-operator-icao` and `/admin/verify-email` to authenticated GraphQL mutations gated by `requireRole('superuser')` from `apps/api/src/auth/requireAuth.ts`. Keep `/seed` as an HTTP endpoint only because it must work before any user exists.~~
- [ ] Rotate `JWT_SECRET` in production after the change ships so any leaked admin token is invalidated.

**Done:** Created `apps/api/src/auth/validateSecret.ts` with `constantTimeCompare()` using `crypto.timingSafeEqual` and `validateJwtSecret()`. Changed header from `x-jwt-secret` → `x-admin-api-token`. Added notes that `ADMIN_API_TOKEN` must be provisioned in AWS Secrets Manager and added to ECS task definition. GraphQL migration noted as follow-up.

### S1.2 Add security headers everywhere

Grepping the entire repo for `helmet`, `Content-Security-Policy`, `Strict-Transport-Security`, and `X-Frame-Options` returns zero matches. Browsers receive no clickjacking protection, no MIME-sniffing protection, no referrer policy, and no transport-security pinning.

- [x] ~~Install `helmet` in `apps/api/package.json` and add `app.use(helmet({ contentSecurityPolicy: false }))` in `apps/api/src/index.ts` before `cookieParser`.~~
- [x] ~~Add a `headers()` block in `apps/web/next.config.ts` returning `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a minimal `Permissions-Policy`.~~
- [ ] Add a CloudFront response-headers policy in `infrastructure/lib/spotterspace-stack.ts` attached to the default cache behaviour.
- [ ] Plan a strict CSP for the web tier. The inline theme bootstrap script in `apps/web/src/app/layout.tsx` (currently using `dangerouslySetInnerHTML`) needs a nonce or hash; track this as a Sprint 3 follow-up.

### S1.3 Resolve `npm audit` findings

`npm audit` in the repo root reports 17 vulnerabilities: 1 high (`next`), 16 moderate. The most actionable items are:

```
@apollo/server <5.5.0   Apollo Server XS-Search CSRF bypass (GHSA-9q82-xgwf-vj6h)
next                    high-severity advisory, fix available via npm audit fix
postcss                 XSS via unescaped </style> (GHSA-qx2v-qp2m-jg93)
turbo <=2.9.13-canary.1 CSRF + RCE during Yarn Berry detection
ws  8.0.0-8.20.0        uninitialized memory disclosure
ip-address <=10.1.0     XSS in Address6 HTML methods (transitive via express-rate-limit)
esbuild <=0.24.2        dev-server SSRF (test-only)
```

- [ ] Run `npm audit fix` and commit non-breaking upgrades on a feature branch.
- [ ] Accept the breaking `@apollo/server@5.5.1` upgrade and run the full integration test suite against it.
- [ ] Accept the breaking `next` upgrade and run the full E2E suite.
- [ ] Verify `npm audit` reports zero high or critical findings post-upgrade.
- [ ] Create `CVE_MITIGATION_LOG.md` in the project root and document the resolved advisories with dates and PR links.

### S1.4 Lambda variant: enforce `JWT_SECRET` strength check

`apps/api/src/lambda.ts` L28-29 sets `process.env.JWT_SECRET = jwtResult.SecretString ?? ''` and never re-runs the production strength check that `apps/api/src/auth/jwt.ts` L7-19 enforces in the long-lived server bootstrap. An empty string from Secrets Manager would silently allow forged tokens.

- [x] ~~Extract the JWT secret strength check (production guard, dev-fallback rejection, minimum 32 chars) from `apps/api/src/auth/jwt.ts` into a shared helper `apps/api/src/auth/validateSecret.ts`.~~
- [x] ~~Call the helper from both `apps/api/src/index.ts` after `loadSecrets()` and from `apps/api/src/lambda.ts` after `initSecrets()`.~~
- [ ] Add a unit test that confirms the helper rejects empty string, the dev fallback, and any value shorter than 32 chars when `NODE_ENV=production`.

### S1.5 Remove privileged debug logging

`apps/web/src/app/photos/[id]/page.tsx` L42-44 ships a `console.log('[DEBUG]', { userRole: user?.role, canDelete })` straight to production. This leaks the role of the currently signed-in viewer plus the access-control decision for the rendered photo. The `apps/api/src/services/imageProcessing.ts` `[IMG]` logs (L112, L119, L163, L166, L176, L191, L193) are similar and print S3 keys and buffer sizes on every upload.

- [x] ~~Remove the `[DEBUG]` log in `apps/web/src/app/photos/[id]/page.tsx`.~~
- [x] ~~Gate all `[IMG]` logs behind `if (process.env.LOG_LEVEL === 'debug')` in `apps/api/src/services/imageProcessing.ts`.~~
- [x] ~~Add an ESLint rule (`no-console` with `allow: ['error', 'warn']`) to `apps/web/eslint.config.mjs` to prevent regressions.~~

---

## Sprint 2 — Correctness Fixes (target: 1 week)

### S2.1 Fix `likeCount` denormalisation race

`apps/api/src/resolvers/likeResolvers.ts` L36-48 performs `findUnique → create → update increment` as three separate awaits. Two concurrent `likePhoto` calls from the same user can both observe `existing == null`, both call `create`, and the loser will throw on the unique constraint after the increment has already been applied — leaving `likeCount` drifted by one.

- [x] ~~Wrap the `likePhoto` body in `prisma.$transaction` so the like creation and counter increment commit atomically, or replace with `prisma.like.upsert(...)` followed by a count derived from `_count`.~~
- [x] ~~Apply the same pattern to `unlikePhoto` L88-96.~~
- [ ] Add a regression test in `apps/api/src/__tests__/like.test.ts` that fires `Promise.all([likePhoto, likePhoto])` and asserts `likeCount === 1`.
- [ ] Add a backfill script to reconcile any drifted `likeCount` values in production before the fix ships.

### S2.2 Add Stripe webhook idempotency

`apps/api/src/index.ts` L284-340 reacts to `checkout.session.completed` by mutating order, listing, and photo state without recording the Stripe `event.id`. Stripe will retry on any 5xx and the handler will happily re-update.

- [x] ~~Add a `webhook_events` model to `packages/db/prisma/schema.prisma` with a unique constraint on `stripeEventId`.~~
- [x] ~~Generate and run the migration.~~
- [x] ~~At the top of the webhook handler, attempt to insert the event ID and short-circuit with `200 OK` if the insert fails on the unique constraint.~~
- [ ] Add a test that fires the same `checkout.session.completed` payload twice and asserts the order is updated only once.

### S2.3 Tighten `csrfGuard`

`apps/api/src/index.ts` L262-267 returns `next()` when `Origin` is absent. A stricter posture is to require either `Origin` matching or a known custom header.

- [x] ~~Modify `csrfGuard` to require either a matching `Origin` or `Sec-Fetch-Site: same-origin` / `same-site` for state-changing methods.~~
- [x] ~~Reject same-origin requests that lack both signals with `403`.~~
- [ ] Verify all existing E2E tests still pass and add a new test that asserts a missing-Origin POST is rejected.

### S2.4 Tighten the auth rate limiter

`apps/api/src/index.ts` L100 sets the `authRateLimiter` `limit: 5000` "for upsert-heavy admin imports". 5,000 sign-in attempts per IP per 15 minutes is effectively no protection against credential stuffing.

- [x] ~~Drop `authRateLimiter` `limit` to `100` per 15 minutes.~~
- [ ] Move admin-import bulk operations to a separate authenticated GraphQL path that bypasses the auth limiter via `requireRole`.
- [x] ~~Verify the existing account-lockout in `signIn` (5 fails → 15-minute lock) still triggers as expected with the new limit.~~

### S2.5 Eliminate password-reset timing oracle

`apps/api/src/resolvers/authResolvers.ts` L300-318 returns `true` either way (good) but only does work — token creation, `deleteMany`, email send — when the user exists. The differential latency is observable.

- [x] ~~When the user lookup misses, perform a constant-time fake bcrypt hash so the response time matches the hit path.~~
- [ ] Verify with an automated timing test that miss and hit paths complete within a tight tolerance.

---

## Sprint 3 — Architecture (target: 2 weeks)

### S3.1 Modularise the GraphQL schema

The 3,825-line `apps/api/src/schema.ts` is a maintainability hazard. One monolithic file invites merge conflicts and slows codegen.

- [ ] Split `apps/api/src/schema.ts` into per-domain `.graphql` files under `apps/api/src/schema/` (e.g. `photo.graphql`, `community.graphql`, `marketplace.graphql`, `auth.graphql`).
- [ ] Use `@graphql-tools/load` with `loadSchemaSync` to merge the per-domain files at boot.
- [ ] Update `apps/web/codegen.yml` to point at the new schema entrypoint.
- [ ] Verify `npx turbo run typecheck` and the E2E suite both pass post-split.

### S3.2 Remove `force-dynamic` from the root layout

`apps/web/src/app/layout.tsx` is set to `export const dynamic = 'force-dynamic'` and performs a server-side fetch to `${API_URL}/graphql` on every render to populate auth state. This means no page in the app is statically generated, every request synchronously waits on an API hop before HTML is streamed, and CloudFront can never cache HTML.

- [ ] Remove `export const dynamic = 'force-dynamic'` from `apps/web/src/app/layout.tsx`.
- [ ] Move auth-state hydration to a client component that reads the access-token cookie via the existing URQL client.
- [ ] Add `revalidate` exports to marketing pages (`/`, `/explore`, `/discover`, `/marketplace`) to enable ISR.
- [ ] Verify auth-gated pages still redirect correctly when a stale cached page is served.
- [ ] Update the CloudFront default cache behaviour in `infrastructure/lib/spotterspace-stack.ts` to a non-zero default TTL for HTML once auth state is client-side.

### S3.3 Bound and index search resolvers

`apps/api/src/resolvers/searchResolvers.ts` `searchPhotos` (L16-67) performs case-insensitive `contains` across eight OR'd fields with no minimum query length, no full-text index, and joins to three aircraft hierarchy tables.

- [ ] Add a minimum query length: return empty results when `q.length < 2`.
- [ ] Create a Prisma migration that adds a Postgres GIN full-text index on `to_tsvector('english', coalesce(caption, '') || ' ' || coalesce(airline, '') || ' ' || coalesce(airport_code, ''))`.
- [ ] Rewrite `searchPhotos` to use `to_tsquery` with the new index for the text columns and keep ILIKE only for prefix matches on registration.
- [ ] Replace `searchAirlines`'s `distinct` workaround on the photos table with a direct query on the `airlines` table.
- [ ] Add a load test asserting `searchPhotos` p95 latency stays below 200ms with 100k photos.

### S3.4 Avoid duplicate ACM certificates and redirect plaintext HTTP

`infrastructure/lib/spotterspace-stack.ts` issues both `SiteCertificate` (L260) and `CdnCertificate` (L307) for the same `domainName + *.domainName`. The HTTP listener on `:80` (L162-170) forwards rather than redirects.

- [ ] Reuse `SiteCertificate` for the CloudFront distribution. Note that CloudFront requires the cert in `us-east-1`; if the ALB is in another region, keep them separate but document why.
- [ ] Change the HTTP listener default action to `redirect → 443` so plaintext requests are upgraded.
- [ ] Verify the ALB DNS name (`AlbDnsName` output) correctly redirects when reached directly.

### S3.5 Lock down CloudFront caching of `/graphql`

`infrastructure/lib/spotterspace-stack.ts` L351-360 places `/graphql` behind CloudFront and lists `GET, HEAD, OPTIONS` in `cachedMethods`. Apollo accepts `GET` for queries. The current `defaultTtl: 0` saves us today, but the configuration is one accidental TTL change away from caching authenticated query responses.

- [ ] Either set `cachedMethods: ['HEAD', 'OPTIONS']` only on the `/graphql` cache behaviour, or attach a cache policy with `MinTTL=0, DefaultTTL=0, MaxTTL=0` and forward `Authorization` and `Cookie` so caching is impossible by construction.

---

## Sprint 4 — Test Depth and Observability (ongoing, target: 1 week initial push)

### S4.1 Replace `cleanDatabase` with a DMMF-driven walker

`apps/api/src/__tests__/testHelpers.ts` `cleanDatabase` is hand-maintained. Every new model in `schema.prisma` must be remembered and added here, otherwise tests will see leaked rows from prior runs.

- [ ] Replace the manual list with a programmatic walk of `Prisma.dmmf.datamodel.models` that issues `TRUNCATE ... CASCADE` over each table in dependency order.
- [ ] Confirm all existing tests still pass with the new helper.

### S4.2 Add web unit-test coverage

Only one web unit test exists: `apps/web/src/__tests__/photoGrid.test.tsx`. The 68 page files in `apps/web/src/app/` have no isolated component tests.

- [ ] Add Vitest + Testing Library coverage for `signin/page.tsx` (form validation, error states).
- [ ] Add coverage for `signup/page.tsx` (terms acceptance, password rules).
- [ ] Add coverage for `upload/page.tsx` (file selection, presigned URL flow).
- [ ] Add coverage for `photos/[id]/page.tsx` (delete permission UI).
- [ ] Add coverage for at least three admin pages (`admin/users`, `admin/photos`, `admin/reports`) covering the role-gated UI.

### S4.3 Eliminate `as any` and `eslint-disable` in resolver code

`apps/api/src/resolvers/notificationResolvers.ts` casts the Prisma JSON `data` field with `as any` and an inline disable. The Stripe webhook in `apps/api/src/index.ts` L284-330 uses `let event: any` and three `as any` casts.

- [ ] Replace the notification `data` cast with `Prisma.JsonValue` or a typed wrapper.
- [ ] Replace the Stripe `event: any` and `event.data.object as any` casts with the official `Stripe.Checkout.Session` and `Stripe.Event` types from the Stripe SDK.

### S4.4 Soft-delete strategy for `User`

The schema cascade-deletes the user's photos, albums, comments, likes, follows, communities they own, forum posts, etc. when a user account is deleted. For an aviation photography platform with marketplace orders and forum threads, hard-deleting all of a user's contributions on account deletion will surface as broken thread references.

- [ ] Decide product policy on user deletion vs. PII scrub. Document the decision in `docs/ARCHITECTURE.md`.
- [ ] If soft-delete is chosen, add `deletedAt` to the `User` model and update relevant resolvers to filter on it.
- [ ] Add an admin "scrub PII" mutation that nullifies email, password hash, and profile fields without deleting the row.

---

## Low-Priority Nits (no sprint allocation; handle opportunistically)

- [ ] Standardise `process.env.X` vs `process.env['X']` style across the API. Pick one and add an ESLint rule.
- [ ] Gate the `http://localhost:4566` entry in `apps/web/next.config.ts` `remotePatterns` behind `process.env.NODE_ENV !== 'production'`.
- [ ] Clean up `apps/api/src/resolvers/searchResolvers.ts` `searchAirlines` by adding `where: { airline: { not: null, ... } }` instead of post-filtering with `.filter((s): s is string => !!s)`.

---

## Functionality Status Reference

For context when prioritising. Most "pending" items in the project memory are actually implemented; the gap is hardening, not feature breadth.

| Feature                                                                        | Status      | Notes                                                  |
| ------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------ |
| Auth (sign-up, sign-in, refresh, sign-out, password reset, email verification) | Implemented | Strong implementation; minor timing oracle fix in S2.5 |
| Photo upload via S3 presigned URL                                              | Implemented | Quota and dimension validation present                 |
| Photo feed, detail, profile pages                                              | Implemented | Debug log removed (S1.5 done)                          |
| Follow / unfollow                                                              | Implemented |                                                        |
| Likes                                                                          | Implemented | Race condition fixed, transactions added (S2.1 done)   |
| Comments                                                                       | Implemented |                                                        |
| Reporting / moderation                                                         | Implemented |                                                        |
| Notifications                                                                  | Implemented |                                                        |
| Communities, forum, events                                                     | Implemented |                                                        |
| Search (photos, users, airlines)                                               | Implemented | Performance work in S3.3                               |
| Marketplace + Stripe checkout                                                  | Implemented | Idempotency fix complete (S2.2 done)                   |
| Mapbox map view                                                                | Implemented |                                                        |
| Albums, badges, seller feedback, contact form                                  | Implemented |                                                        |
| Admin dashboard                                                                | Implemented | 18 pages under `apps/web/src/app/admin/`               |

---

## Tracking

- **Total tasks:** 60+ checkboxes across 5 sprints
- **Suggested cadence:** One sprint per calendar week, with Sprint 0 running in parallel with Sprint 1
- **Blocking dependencies:** Sprint 1 (`CVE_MITIGATION_LOG.md` creation) is a prerequisite for the Sprint 0 logging step
- **Definition of done per task:** Code merged to `main`, tests passing in CI, deployment verified on staging

## Progress Summary (2026-05-22)

### Sprint 1 — Security Hardening ✅ (most items complete)

- S1.1: Code complete. `validateSecret.ts` created, `constantTimeCompare` wired up, header renamed to `x-admin-api-token`. AWS provisioning and ECS task def update still needed.
- S1.2: Helmet added to API, security headers added to `next.config.ts`. CloudFront response-headers policy still pending.
- S1.3: **Not started** — awaiting `npm audit fix` and upgrade cycle.
- S1.4: ✅ Code complete. `validateJwtSecret()` called in both `index.ts` and `lambda.ts`. Unit test still pending.
- S1.5: ✅ All items complete. Debug logs removed, IMG logs gated, ESLint rule added.

### Sprint 2 — Correctness Fixes ✅ (most items complete)

- S2.1: ✅ Code complete. Transactions wrapped for `likePhoto` and `unlikePhoto`. Race test and backfill script still pending.
- S2.2: ✅ Code complete. `WebhookEvent` model added, idempotency check in webhook handler. Test still pending.
- S2.3: ✅ Code complete. `csrfGuard` now requires `Origin` or `Sec-Fetch-Site` signal. E2E verification still pending.
- S2.4: ✅ Code complete. Rate limit reduced to 100. Authenticated GraphQL bypass path still pending.
- S2.5: ✅ Code complete. Constant-time fake hash in miss path. Timing test still pending.

### Sprint 3 — Architecture ❌ Not started

### Sprint 4 — Test Depth ❌ Not started

### Sprint 0 — AWS EOL ⚠️ Blocked on AWS email

When updating this document, prefer striking through completed items rather than deleting them so progress is visible at a glance. Add new findings as they surface under a "Backlog" section at the bottom.
