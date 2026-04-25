# Security

> **Last updated:** 2026-04-26

---

## Authentication & Authorization

### JWT Authentication

- API uses JWT tokens for user authentication
- Tokens are validated via `JWT_SECRET` environment variable
- In production, tokens are verified against the secret stored in AWS Secrets Manager (`spotterhub/JWT_SECRET`)
- **Critical:** The dev fallback (`dev-secret-do-not-use-in-production`) is rejected at startup in production mode (`apps/api/src/index.ts:68-76`). The API refuses to start if `JWT_SECRET` is missing or is the dev default.
- Tokens are passed via `Authorization: Bearer <token>` header or `access_token` HttpOnly cookie (set by sign-in mutation)

### Role-Based Access Control

Users have one of four roles: `user`, `moderator`, `admin`, `superuser`.

| Endpoint                                                | Protection                           |
| ------------------------------------------------------- | ------------------------------------ |
| Public queries (photos, airports, search)               | No auth required                     |
| Auth mutations (like, comment, follow)                  | JWT required                         |
| Admin queries (adminStats, adminUsers)                  | `moderator` or `admin` role required |
| Admin mutations (ban, delete, update roles)             | `admin` or `superuser` role required |
| Superuser-only (delete superuser, promote to superuser) | `superuser` role required            |

### Auth Middleware

- `requireAuth(ctx)` — throws `UNAUTHENTICATED` if no valid JWT
- `requireRole(ctx, ['admin', 'moderator'])` — throws `FORBIDDEN` if role insufficient
- `getDbUser(ctx)` — returns the Prisma user record (or null if unauthenticated)

### Seed/Admin HTTP Endpoints

- `/seed` — POST with `x-jwt-secret` header matching `JWT_SECRET`. Rate-limited (5 requests per 15 min).
- `/admin/verify-email` — POST with `x-jwt-secret` header. Rate-limited (5000 requests per 15 min).

---

## API Security

### CORS

CORS is configured to allow only the production web domains:

```ts
const allowedOrigins = [
  process.env.WEB_BASE_URL ?? 'http://localhost:3000',
  `https://www.${new URL(process.env.WEB_BASE_URL).hostname}`,
];
```

- In production (`NODE_ENV === 'production'`): only whitelisted origins allowed
- In development: CORS accepts any origin (dev mode)

### Introspection

GraphQL introspection is **disabled in production** (`introspection: process.env.NODE_ENV !== 'production'` in `apps/api/src/index.ts`). This prevents attackers from enumerating the full schema.

### Rate Limiting

Three rate limiters protect different attack surfaces:

| Limiter           | Window | Limit      | Applied To                                    |
| ----------------- | ------ | ---------- | --------------------------------------------- |
| `graphqlLimiter`  | 1 min  | 100 req/IP | All GraphQL `/graphql` requests               |
| `authRateLimiter` | 15 min | 5000 req   | Auth-related mutations (signin, signup, etc.) |
| `seedRateLimiter` | 15 min | 5 req      | `/seed` HTTP endpoint                         |

The trust proxy setting (`app.set('trust proxy', 1)`) ensures rate limiters use the real client IP from the ALB.

### GraphQL Query Complexity

No query depth or complexity limits are currently configured. Consider adding `@graphql-query-complexity` or similar library if abuse becomes an issue.

---

## Secrets Management

Production secrets are stored in **AWS Secrets Manager** and fetched at startup:

| Secret                      | Used By                                            |
| --------------------------- | -------------------------------------------------- |
| `spotterhub/DATABASE_URL`   | ECS task definition (injected as env var)          |
| `spotterhub/JWT_SECRET`     | ECS task definition (injected as env var)          |
| `spotterhub/RESEND_API_KEY` | Fetched at runtime if missing (for email features) |

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

1. Client requests a presigned URL via `getUploadUrl` mutation (auth required)
2. Client uploads directly to S3 using the presigned URL
3. API validates the uploaded file (type, size) before processing

---

## Input Validation

### GraphQL Input

- All GraphQL inputs are validated at the resolver level
- String inputs (captions, bios, etc.) accept any value — moderation pipeline handles content safety
- Photo uploads pass through Sharp for processing, stripping EXIF metadata by default

### SQL Injection

- All database queries use Prisma ORM (parameterized queries)
- No raw SQL string interpolation in resolvers

### XSS Prevention

- React escapes output by default
- User-generated content (captions, bios, comments) is not sanitized server-side — frontend renders as text, not HTML

---

## Infrastructure

### Network

- RDS PostgreSQL runs in **private subnets** (not publicly accessible)
- ECS tasks run in the same VPC with no public IP
- ALB exposes port 443 to the internet for web and API

### ECS Security Groups

- Web/API ECS tasks: allow inbound from ALB only
- RDS: allow inbound from ECS security group on port 5432

### Keep-Warm Cron

A CloudWatch Events rule (`spotterhub-keep-warm-rule`) triggers every 5 minutes, invoking a Lambda (`spotterhub-keep-warm`) that pings:

- `https://www.spotterspace.com`
- `https://api.spotterspace.com/health`

This keeps ECS tasks warm and prevents cold starts. Cost: ~$0.50/month.

---

## Known Limitations

1. **No query complexity limits** — expensive nested queries are not throttled
2. **No content sanitization** — XSS is mitigated by React's default escaping but not actively prevented server-side
3. **No AWS Cognito** — auth is mocked JWT; in production, integrate with Cognito for proper identity management
4. **No Redis/ElastiCache** — session data not cached; no rate limit state sharing across instances
5. **No audit logging** — sensitive admin actions are not independently logged

---

## Reporting a Security Issue

If you discover a security vulnerability, please report it to the project maintainers via GitHub Issues (marked as confidential) or directly to the repository admins.
