# SpotterHub — Project Status

> **Last updated:** 2026-04-25
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
- [x] Sharp image processing (thumbnail 150px, display 640px, watermarked variant)
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
- [x] `/settings/site` — custom banner and tagline

### Aircraft Taxonomy

- [x] Manufacturer → Family → Variant hierarchy
- [x] Aircraft-specific categories
- [x] Airlines with ICAO/IATA codes
- [x] Photo fields: msn, manufacturingDate, operatorIcao, operatorType
- [x] CSV import/export for admin aircraft data

### Site Settings

- [x] Custom homepage banner and tagline (stored in SiteSettings singleton)
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
- Full-res photo variant generation (watermarked variant generated, but full_res variant not yet)

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
- **Migrations:** Run automatically on API container startup via `docker-entrypoint.sh`. The entrypoint also performs a one-time migration history reset if old squashed migration entries exist.
- **Photo URLs:** Seed data photos have `original_url` pointing to LocalStack bucket paths that must be seeded separately via `seed-images.ts`.
- **ECS Fargate migration:** Previously used App Runner. Migrated to ECS Fargate + ALB to fix ALB health check timeout issues (ECS services need `loadBalancers` config to register with ALB target groups).
- **Explore page:** The `/explore` page replaced the separate `/discover` and `/following` pages. It shows "Your Following" sections at the top of each tab and "Browse All" below.
- **Follow system:** Supports airline, registration, manufacturer, family, variant, aircraft_type target types. `isFollowedByMe` is exposed on all topic types.

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
