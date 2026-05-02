# SpotterHub — Project Status

> **Last updated:** 2026-05-02
> **Purpose:** Living document tracking implemented features and operational notes. See `PRODUCT.md` for current product overview.

---

## Current Architecture

- **Stack:** Turborepo monorepo, Next.js App Router (web), Apollo Server GraphQL (api), Prisma + PostgreSQL/PostGIS, S3 (LocalStack in dev, AWS in prod)
- **Infrastructure:** ECS Fargate + ALB (replaced App Runner), RDS PostgreSQL 16 (private subnets), CloudFront, Secrets Manager
- **CI/CD:** GitHub Actions — lint → typecheck → test → build on PR/push; Docker build → ECR push → ECS redeploy on push to main
- **Auth:** Dev-mode JWT auth (SHA-256 hashed passwords stored as cognitoSub). Production uses same auth flow with real JWT tokens.

---

## Implemented Features

### Core Platform

- [x] Monorepo setup (apps/web, apps/api, packages/db)
- [x] Docker Compose local dev (Postgres 5433, Redis 6379, LocalStack S3 4566)
- [x] TypeScript strict, ESLint, Prettier, Husky pre-commit
- [x] CI pipeline (GitHub Actions)

### Auth & Profiles

- [x] User signup with email/password (mock dev auth, no Cognito yet)
- [x] Sign-in mutation
- [x] JWT token storage in localStorage
- [x] `me`, `user(username)` queries, `updateProfile` mutation
- [x] Display name on signup → profile
- [x] User role system: user, moderator, admin, superuser

### Photos

- [x] Upload with S3 presigned URLs
- [x] Sharp image processing (thumbnail 150px, thumbnail 16:9 640×360, display 640px, watermarked variant)
- [x] Photo license selection (All Rights Reserved, CC BY variants) on upload
- [x] Watermark option (© SpotterSpace overlay) on upload
- [x] Photo CRUD, variants, tags
- [x] Geotagging with privacy modes (exact / approximate / hidden)
- [x] EXIF extraction (GPS, camera date)
- [x] Map pin on upload form
- [x] Photo detail page with map, comments, likes
- [x] Similar aircraft photos section (by msn or aircraftId)
- [x] Moderation status (pending / approved / rejected)

### Albums

- [x] Personal albums (CRUD, add/remove photos, cover photo)
- [x] Community albums (separate junction table `AlbumPhoto`)
- [x] AddPhotosModal for picking photos from personal collection

### Users & Social

- [x] Follow/unfollow users
- [x] Follower/following counts and lists
- [x] User profile pages with photos tab
- [x] Like button with optimistic UI
- [x] Comment system with threaded replies (2 levels)
- [x] Report content (photo, comment, profile, album)

### Follow System (Topics)

- [x] Follow/unfollow airlines (by ICAO code)
- [x] Follow/unfollow aircraft manufacturers
- [x] Follow/unfollow aircraft families
- [x] Follow/unfollow aircraft variants
- [x] Follow/unfollow registrations
- [x] Follow/unfollow aircraft types
- [x] Explore page (`/explore`) — unified browse + follow UI with "Your Following" sections
- [x] Following topics shown in Explore page per tab

### Map & Locations

- [x] Mapbox GL JS map with Supercluster photo markers
- [x] Airport pages with spotting locations
- [x] Photos in bounds / nearby queries (PostGIS-ready, bounding-box Haversine currently)
- [x] Create/delete spotting locations

### Search

- [x] PostgreSQL full-text search (tsvector/tsquery)
- [x] Search across photos, users, airports
- [x] Search page with type filters

### Communities

- [x] Create community with slug, banner, category, visibility
- [x] Public discovery directory with search/category filter
- [x] Join/leave, invite codes for invite-only
- [x] Member roles: owner, admin, moderator, member
- [x] Community page with tabs: Photos, Albums, Members, Moderation, Forum, Events, Settings
- [x] Community admin panel (`/communities/[slug]/admin`) with Overview / Members / Roles / Moderation tabs
- [x] Member search, role filter, ban/unban, kick, role changes
- [x] Transfer ownership
- [x] Community banner/avatar upload

### Forums (Global + Community-scoped)

- [x] Global forum at `/forum` (site-wide categories)
- [x] Community forum at `/communities/[slug]/forum`
- [x] Category CRUD (owner/admin)
- [x] Thread CRUD, pin/lock (moderators)
- [x] Post CRUD with soft-delete, 24h edit window
- [x] Nested replies (2 levels)
- [x] Collapse/expand reply threads

### Events

- [x] Create community events (title, description, location, start/end, capacity)
- [x] RSVP (going/maybe/not going)
- [x] Event detail page with attendee list
- [x] Community events preview in sidebar

### Notifications

- [x] In-app notification bell (polls every 30s)
- [x] Notification triggers: like, comment, follow, community join, event RSVP
- [x] Mark read / mark all read / delete

### Marketplace (Aviation Collectibles)

- [x] Create/edit/delete marketplace listings
- [x] Listing categories, conditions, pricing
- [x] Seller profiles and listings pages
- [x] Browse marketplace with search/filter
- [x] Contact seller flow

### Admin Panel

- [x] `/admin` dashboard with stats
- [x] `/admin/users` — role/status management, search
- [x] `/admin/photos` — moderation queue
- [x] `/admin/reports` — flag queue
- [x] `/admin/aircraft` — aircraft type management
- [x] `/admin/manufacturers` — manufacturer CRUD
- [x] `/admin/families` — aircraft family CRUD
- [x] `/admin/variants` — aircraft variant CRUD
- [x] `/admin/airlines` — airline CRUD
- [x] `/admin/aircraft-specific-categories` — CRUD
- [x] `/admin/photo-categories` — photo category CRUD
- [x] `/admin/airports` — airport management
- [x] `/admin/pending-list-items` — pending aircraft types/variants/manufacturers/categories
- [x] `/admin/settings` — general settings (photo dimension limits)
- [x] `/settings/site` — custom banner and tagline
- [x] Admin/moderator soft-delete + hard-delete for photos, albums, forum threads, forum posts, comments (requires role + reason logged to moderation audit)

### Aircraft Taxonomy

- [x] Manufacturer → Family → Variant hierarchy
- [x] Aircraft-specific categories
- [x] Airlines with ICAO/IATA codes
- [x] Photo fields: msn, manufacturingDate, operatorIcao, operatorType
- [x] CSV import/export for admin aircraft data

### Site Settings

- [x] Custom homepage banner and tagline (stored in SiteSettings singleton)
- [x] Admin-configurable photo dimension limits (min/max long edge)
- [x] Dark/light mode toggle (persisted to localStorage)

### Pages & UI

- [x] Homepage with magazine layout and site settings banner
- [x] Communities directory page
- [x] Global forum pages
- [x] Legal notice (`/legal-notice`) and imprint pages
- [x] Upload page redesigned
- [x] Signup page with display name field
- [x] Explore page (`/explore`) — unified browse and follow for topics

---

## Not Yet Implemented

- AWS Cognito auth wiring (dev mock JWT used in production)
- Stripe billing (community subscriptions, individual premium)
- Native mobile app
- Video uploads
- In-platform checkout / payments (marketplace contact flow only)
- Email system (SES) — transactional and digest emails
- Analytics and KPI instrumentation
- SEO implementation (SSR metadata, sitemaps, structured data)
- WCAG 2.1 AA accessibility audit
- Performance load testing
- Redis (ElastiCache) — currently no caching layer
- OpenSearch — search currently uses PostgreSQL full-text
- Full-res photo variant generation (thumbnail, display, and watermarked variants work; full_res variant not yet generated)

---

## Local Development

```bash
# Start all services
docker compose -f docker/docker-compose.yml up

# Run migrations
npx prisma migrate dev --schema packages/db/prisma/schema.prisma

# Seed database (users, airports, sample photos)
npm run db:seed -w packages/db

# Seed S3 images (LocalStack)
npm run db:seed-images -w packages/db

# Run dev servers (API + Web concurrently)
npm run dev

# Run tests
npx turbo run test

# Generate GraphQL types (after schema changes)
npx turbo run generate --filter=@spotterspace/db
```

---

## Key Notes

- **LocalStack S3:** Community edition doesn't persist across restarts. Re-run `npm run db:seed-images` after LocalStack restarts.
- **Migrations:** Run automatically on API container startup via `docker-entrypoint.sh`. The entrypoint simply runs `prisma migrate deploy` and starts the server (no recovery or cleanup logic).
- **Photo URLs:** Seed data photos have `original_url` pointing to LocalStack bucket paths that must be seeded separately via `seed-images.ts`.
- **ECS Fargate migration:** Previously used App Runner. Migrated to ECS Fargate + ALB to fix ALB health check timeout issues (ECS services need `loadBalancers` config to register with ALB target groups).
- **Explore page:** The `/explore` page replaced the separate `/discover` and `/following` pages. It shows "Your Following" sections at the top of each tab and "Browse All" below.
- **Follow system:** Supports airline, registration, manufacturer, family, variant, aircraft_type target types. `isFollowedByMe` is exposed on all topic types.
- **Sharp image processing (production fix):** ESM dynamic `import('sharp')` was returning a module object instead of the Sharp function. Fixed with `mod.default ?? mod` to unwrap correctly. Docker image explicitly installs `@img/sharp-linuxmusl-arm64` and `@img/sharp-linuxmusl-x64` after `npm prune` to ensure native binaries survive the prune step.
- **Watermark rendering:** Docker image installs `font-noto` and `fontconfig` packages so Sharp's SVG composite can render text. When `watermarkEnabled` is true during upload, a "© SpotterSpace" watermark is composited onto the display-size image in the bottom-right corner using Sharp's SVG overlay.
- **`regeneratePhotoVariants` mutation:** Allows photo owners and admins to re-trigger variant generation (thumbnail, display, watermarked) for existing photos. Useful after fixing processing bugs or changing watermark logic.
- **Feed thumbnail priority:** `PhotoCard.tsx` always prefers `thumbnail_16x9` for uniform 16:9 aspect ratio in feed cards, regardless of watermark setting. The watermarked variant is used only on the photo detail page.

---

## Incident Log

### 2026-05-02 — Production Database Missing Tables (P1)

**Impact:** API completely down (503). ALB had no healthy targets because all ECS tasks crashed on startup.

**Root cause:** The production RDS PostgreSQL database was missing ~45 tables (including `users`, `refresh_tokens`, `forum_threads`, `contact_message`, `seller_profiles`, etc.). The `_prisma_migrations` table still had records for all 20 migrations, so `prisma migrate deploy` in `docker-entrypoint.sh` considered them already applied and skipped recreation. Additionally, the entrypoint contained a destructive recovery block that dropped `refresh_tokens` and `_prisma_migrations` on migration failure, making the situation worse.

**Resolution:**

1. Registered a one-off ECS task definition with an entrypoint override to get a shell inside the VPC.
2. Ran `prisma db push --accept-data-loss` to recreate all missing tables from the Prisma schema.
3. Ran `prisma migrate resolve --applied` for all 20 migrations to baseline `_prisma_migrations`.
4. Forced a new ECS deployment → 2/2 API tasks became healthy, ALB returned 200.
5. Removed the destructive recovery logic from `docker-entrypoint.sh` (DROP TABLE statements for `refresh_tokens` and `_prisma_migrations`). The entrypoint now simply runs `prisma migrate deploy` and starts the server.
6. Deregistered the one-off task definitions after use.

**Lessons learned:**

- Never include DROP TABLE statements in automated startup scripts.
- `prisma migrate deploy` is safe and idempotent, but it cannot recover from missing tables when `_prisma_migrations` says they were already created.
- For schema drift emergencies, `prisma db push` can recreate tables, followed by `prisma migrate resolve --applied` to re-baseline migration history.

---

## File Reference

| Area             | Key Files                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema    | `packages/db/prisma/schema.prisma`                                                                                           |
| Seed scripts     | `packages/db/prisma/seed.ts`, `seed-images.ts`, `seed-aircraft-types.ts`, `seed-categories.ts`, `seed-aircraft-hierarchy.ts` |
| API entry point  | `apps/api/src/index.ts`                                                                                                      |
| GraphQL schema   | `apps/api/src/schema.ts`                                                                                                     |
| API resolvers    | `apps/api/src/resolvers/`                                                                                                    |
| API tests        | `apps/api/src/__tests__/`                                                                                                    |
| Auth utilities   | `apps/api/src/auth/`                                                                                                         |
| Image processing | `apps/api/src/services/imageProcessing.ts`                                                                                   |
| S3 service       | `apps/api/src/services/s3.ts`                                                                                                |
| Web layout       | `apps/web/src/app/layout.tsx`                                                                                                |
| GraphQL client   | `apps/web/src/lib/graphql.ts`                                                                                                |
| Frontend queries | `apps/web/src/lib/queries.ts`                                                                                                |
| Generated types  | `apps/web/src/lib/generated/graphql.ts`                                                                                      |
| UI components    | `apps/web/src/components/`                                                                                                   |
| Docker Compose   | `docker/docker-compose.yml`                                                                                                  |
| CI workflow      | `.github/workflows/ci.yml`                                                                                                   |
| Deploy workflow  | `.github/workflows/deploy.yml`                                                                                               |
| API Dockerfile   | `apps/api/Dockerfile`                                                                                                        |
| API entrypoint   | `apps/api/docker-entrypoint.sh`                                                                                              |
| Web Dockerfile   | `apps/web/Dockerfile`                                                                                                        |
