# Security

> **Last updated:** 2026-05-22

---

## Authentication & Authorization

### JWT Authentication

- API uses JWT tokens for user authentication
- Tokens are validated via `JWT_SECRET` environment variable
- In production, tokens are verified against the secret stored in AWS Secrets Manager (`spotterhub/JWT_SECRET`)
- **Critical:** The dev fallback (`dev-secret-do-not-use-in-production`) is rejected at startup in production mode. The shared helper `apps/api/src/auth/validateSecret.ts` (`validateJwtSecret`) enforces a 32-character minimum, rejects empty strings, and rejects the dev-fallback literal whenever `NODE_ENV === 'production'`. The check runs from both bootstrap paths: `apps/api/src/index.ts` after `loadSecrets()` and `apps/api/src/lambda.ts` after `initSecrets()`. The API refuses to start if the check fails.
- Tokens are passed via `Authorization: Bearer <token>` header or `access_token` HttpOnly cookie (set by sign-in mutation).

### Password Storage

User passwords are bcrypt-hashed and stored in the `password_hash` column on the `users` table (`User.passwordHash` in `packages/db/prisma/schema.prisma`). The `cognito_sub` column is a separate identifier reserved for future AWS Cognito integration and is **not** related to password storage. Sign-in compares the submitted password against `passwordHash` via `bcrypt.compare`. Failed sign-ins for an existing email are counted toward an account-level lockout (5 failures → 15-minute lock) on top of the IP-based rate limiter described below.

The password reset flow performs a constant-time fake bcrypt hash on the user-not-found path so the response time of `requestPasswordReset` does not leak whether an email exists in the database. The mitigation is verified by `apps/api/src/__tests__/passwordResetTiming.test.ts`.

### Role-Based Access Control

Users have one of four roles: `user`, `moderator`, `admin`, `superuser`.

| Endpoint                                                                           | Protection                                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public queries (photos, airports, search)                                          | No auth required                                                                          |
| Auth mutations (like, comment, follow)                                             | JWT required                                                                              |
| Admin queries (adminStats, adminUsers)                                             | `moderator` or `admin` role required                                                      |
| Admin mutations (ban, delete content, update roles)                                | `admin` or `superuser` role required                                                      |
| Soft-delete / hard-delete content (photos, albums, forum threads, posts, comments) | `admin`, `moderator`, or `superuser` — reason required, action logged to moderation audit |
| Superuser-only (delete superuser, promote to superuser)                            | `superuser` role required                                                                 |

### Auth Middleware

- `requireAuth(ctx)` — throws `UNAUTHENTICATED` if no valid JWT
- `requireRole(ctx, ['admin', 'moderator'])` — throws `FORBIDDEN` if role insufficient
- `getDbUser(ctx)` — returns the Prisma user record (or null if unauthenticated)

### Seed/Admin HTTP Endpoints

Three privileged HTTP endpoints exist outside the GraphQL surface in `apps/api/src/index.ts`. They authenticate the caller against `process.env.ADMIN_API_TOKEN` using `crypto.timingSafeEqual` (wrapped in `apps/api/src/auth/validateSecret.ts` `constantTimeCompare`) so the comparison is not vulnerable to timing analysis.

| Endpoint                   | Header              | Rate limit       | Notes                                                                  |
| -------------------------- | ------------------- | ---------------- | ---------------------------------------------------------------------- |
| `/seed`                    | `x-admin-api-token` | 5 req / 15 min   | Bootstrapping endpoint; must work before any user exists               |
| `/admin/verify-email`      | `x-admin-api-token` | 100 req / 15 min | Tracked for migration to a `requireRole('superuser')` GraphQL mutation |
| `/admin/fix-operator-icao` | `x-admin-api-token` | 100 req / 15 min | Tracked for migration to a `requireRole('superuser')` GraphQL mutation |

`ADMIN_API_TOKEN` must be provisioned in AWS Secrets Manager and added to the ECS task definition before these endpoints are usable in production. The token is intentionally separate from `JWT_SECRET` so the two trust domains do not couple.

---

## API Security

### Helmet Security Headers

The Express app calls `app.use(helmet({ contentSecurityPolicy: false }))` early in the middleware chain in `apps/api/src/index.ts`. This sets `X-Content-Type-Options: nosniff`, `X-DNS-Prefetch-Control: off`, `X-Download-Options: noopen`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`, `X-Permitted-Cross-Domain-Policies: none`, and `Referrer-Policy: no-referrer`. The CSP is disabled at this layer because the API serves only JSON; the web tier owns its own CSP via Next.js `headers()` and the CloudFront response-headers policy.

### CSRF Guard

State-changing requests (`POST`, `PATCH`, `DELETE`) pass through `csrfGuard` in `apps/api/src/index.ts`. The guard requires either an `Origin` header that matches an allow-listed origin **or** a `Sec-Fetch-Site` header set to `same-origin` or `same-site`. Requests that lack both signals are rejected with `403`. Read-only (`GET`, `HEAD`, `OPTIONS`) requests are not gated. The behaviour is exercised by `e2e/auth.spec.ts` (`Auth — CSRF guard` block, four cases covering missing-Origin, mismatched-Origin, matching-Origin, and read-only GET).

### CORS

CORS is configured to allow only the production web domains:

```ts
const allowedOrigins = [
  process.env.WEB_BASE_URL ?? 'http://localhost:3000',
  `https://www.${new URL(process.env.WEB_BASE_URL).hostname}`,
];
```

In production (`NODE_ENV === 'production'`) only whitelisted origins are allowed. In development CORS accepts any origin for ergonomics.

### Introspection

GraphQL introspection is **disabled in production** (`introspection: process.env.NODE_ENV !== 'production'` in `apps/api/src/index.ts`). This prevents attackers from enumerating the full schema.

### Rate Limiting

Three rate limiters protect different attack surfaces. Limits and windows are sourced directly from `apps/api/src/index.ts` and verified against the file at the timestamp at the top of this document.

| Limiter            | Window | Limit        | Applied To                                              |
| ------------------ | ------ | ------------ | ------------------------------------------------------- |
| `graphqlLimiter`   | 1 min  | 100 req / IP | All GraphQL `/graphql` requests                         |
| `authRateLimiter`  | 15 min | 100 req / IP | Auth-related mutations (signin, signup, password reset) |
| `seedRateLimiter`  | 15 min | 5 req / IP   | `/seed` HTTP endpoint                                   |
| `adminRateLimiter` | 15 min | 100 req / IP | `/admin/verify-email` and `/admin/fix-operator-icao`    |

The trust proxy setting (`app.set('trust proxy', 1)`) ensures rate limiters use the real client IP from the ALB.

The 100-per-15-minutes ceiling on `authRateLimiter` is paired with the per-account lockout described under Password Storage. Bulk admin imports that previously needed the historical 5,000-per-15-minutes window must be migrated to authenticated GraphQL paths gated by `requireRole`; that migration is tracked in `docs/CODE_REVIEW_ACTION_PLAN_2026_05_22.md` Sprint 2.

### Stripe Webhook Idempotency

`apps/api/src/index.ts` (the `/webhooks/stripe` handler) records every Stripe event ID in the `webhook_events` table via the `WebhookEvent` model in `packages/db/prisma/schema.prisma`. The model has a unique constraint on `stripe_event_id`. The handler attempts to insert the row first; if the insert fails on the unique constraint, the handler short-circuits with `200 OK` and performs no business-state mutation. This guarantees that a Stripe retry caused by a `5xx` response does not double-update orders, listings, or photo state. The contract is exercised by `apps/api/src/__tests__/webhookIdempotency.test.ts`.

### GraphQL Query Complexity

No query depth or complexity limits are currently configured. Consider adding `graphql-query-complexity` or similar if abuse becomes an issue.

---

## Web-Tier Security Headers

### Next.js `headers()`

The Next.js app exposes a `headers()` block in `apps/web/next.config.ts` that emits the following on every response:

```text
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()
```

A strict CSP is **not** set at this layer because the inline theme bootstrap script in `apps/web/src/app/layout.tsx` currently uses `dangerouslySetInnerHTML` and would need a per-request nonce to be CSP-compatible. Per-request CSP nonce middleware is tracked as the remaining S1.2 sub-item in the action plan.

### CloudFront Response-Headers Policy

`infrastructure/lib/spotterspace-stack.ts` defines `CdnResponseHeadersPolicy` and attaches it to all four cache behaviours of the CloudFront distribution (default, `/_next/static`, `/_next/image`, `/graphql`). The policy emits HSTS (1 year + preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a baseline `Permissions-Policy`, and a non-strict baseline CSP. The CDN-tier CSP is a backstop; the Next.js middleware nonce work is what will eventually carry the strict policy.

### ALB HTTP → HTTPS Redirect

The ALB listener on `:80` is configured with a `redirect → HTTPS :443` default action in `infrastructure/lib/spotterspace-stack.ts`. Plaintext requests reaching the ALB DNS name directly are upgraded to HTTPS rather than served.

---

## Secrets Management

Production secrets are stored in **AWS Secrets Manager** and fetched at startup:

| Secret                             | Used By                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `spotterhub/DATABASE_URL`          | ECS task definition (injected as env var)                             |
| `spotterhub/JWT_SECRET`            | ECS task definition (injected as env var)                             |
| `spotterhub/ADMIN_API_TOKEN`       | ECS task definition (required for `/seed` and `/admin/*`)             |
| `spotterhub/RESEND_API_KEY`        | Fetched at runtime if missing (for email features)                    |
| `spotterhub/STRIPE_SECRET_KEY`     | Stripe Connect marketplace; used by `apps/api/src/services/stripe.ts` |
| `spotterhub/STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification                                 |

ECS task definition references secrets:

```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:us-east-1:654654553862:secret:spotterhub/DATABASE_URL-fFpNor:DATABASE_URL::"
}
```

**Never commit secrets to source control.** The `.env.local` file (excluded in `.gitignore`) contains only non-sensitive local tokens.

---

## Data Exposure

### Public Data

These fields are publicly accessible (no auth required):

- Photo metadata (caption, tags, location, aircraft info)
- User profiles (username, display name, bio, avatar)
- Airport and spotting location data
- Marketplace listings

### Protected Data

These require authentication:

- User email (only exposed to self via `me` query)
- Draft albums, private community memberships
- Notification data
- Follow relationships (visible to others via `isFollowedByMe` on public queries)

---

## S3 / CloudFront

### Bucket Policy

The `spotterhub-photos` S3 bucket is accessible **only via CloudFront**:

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::spotterhub-photos/*"
}
```

Direct S3 access is blocked. CloudFront distribution (`d2ur47prd8ljwz.cloudfront.net`) serves all photo assets.

### Upload Security

Photo uploads use S3 presigned URLs:

1. Client requests a presigned URL via `getUploadUrl` mutation (auth required).
2. Client uploads directly to S3 using the presigned URL.
3. API validates the uploaded file (type, size) before processing.

---

## Input Validation

### GraphQL Input

- All GraphQL inputs are validated at the resolver level.
- String inputs (captions, bios, etc.) accept any value — moderation pipeline handles content safety.
- Photo uploads pass through Sharp for processing, stripping EXIF metadata by default.

### SQL Injection

- All database queries use Prisma ORM (parameterized queries).
- The two `prisma.$queryRawUnsafe` and `$executeRawUnsafe` calls in `apps/api/src/index.ts` use only static SQL with no user input.

### XSS Prevention

- React escapes output by default.
- User-generated content (captions, bios, comments) is not sanitized server-side — frontend renders as text, not HTML.

---

## Infrastructure

### Network

- RDS PostgreSQL runs in **private subnets** (not publicly accessible).
- ECS tasks run in the same VPC with no public IP.
- ALB exposes port 443 to the internet for web and API; port 80 redirects to 443.

### ECS Security Groups

- Web/API ECS tasks: allow inbound from ALB only.
- RDS: allow inbound from ECS security group on port 5432.

### ECS Circuit Breaker

The ECS circuit breaker is currently **disabled** on both the api and web services. A bad deployment that causes containers to crash-loop will not automatically roll back; the service will continue attempting to start the failing task revision indefinitely. The 2026-05-22 incident was prolonged partly because a failed migration row caused every new container to crash without the circuit breaker triggering a rollback. Adding `circuitBreaker: { enable: true, rollback: true }` to the CDK service definitions is a pending improvement.

### Keep-Warm Cron

A CloudWatch Events rule (`spotterhub-keep-warm-rule`) triggers every 5 minutes, invoking a Lambda (`spotterhub-keep-warm`) that pings:

- `https://www.spotterspace.com`
- `https://api.spotterspace.com/health`

This keeps ECS tasks warm and prevents cold starts. Cost: ~$0.50/month.

---

## Known Limitations

1. **No GraphQL query complexity limits** — expensive nested queries are not throttled.
2. **No content sanitization** — XSS is mitigated by React's default escaping but not actively prevented server-side.
3. **No AWS Cognito** — auth uses bcrypt-hashed passwords against a Prisma-managed table; the `cognitoSub` column is reserved for future Cognito integration but is not currently populated.
4. **No Redis/ElastiCache** — session data not cached; no rate limit state sharing across instances. The current rate limiters are per-instance, so horizontally scaling the API will linearly increase the effective per-IP limit.
5. **CSP at the web tier is non-strict** — strict CSP requires per-request nonce middleware, tracked as the remaining S1.2 sub-item.
6. **Moderation audit logs** exist for soft/hard deletes and community actions but not for all sensitive admin operations (e.g., role changes, bulk operations).
7. **ECS circuit breaker disabled** — crash-looping deployments do not auto-rollback. See ECS Circuit Breaker note under Infrastructure.

---

## Reporting a Security Issue

If you discover a security vulnerability, please report it to the project maintainers via GitHub Issues (marked as confidential) or directly to the repository admins.
