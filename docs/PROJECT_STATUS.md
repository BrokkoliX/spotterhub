# SpotterHub — Project Status

> **Last updated:** 2026-04-08
> **Purpose:** Living document tracking implementation progress against the roadmap. Update after each session.

---

## Quick Reference

- **Roadmap docs:** `docs/implementation_plan_phase_0_1a.md`, `docs/spotter_portal_production_ready_plan.md`
- **Tech stack:** Turborepo monorepo, Next.js App Router (web), Apollo Server GraphQL (api), Prisma + PostgreSQL/PostGIS, LocalStack S3, Sharp image processing, URQL client
- **Local dev:** `docker/docker-compose.yml` → Postgres (5433), Redis (6379), LocalStack S3 (4566)
- **Seed data:** `packages/db` → `npm run db:seed` (users/airports/photos), `npm run db:seed-images` (S3 image variants)
- **LocalStack note:** Community edition doesn't persist S3 data across restarts. Bucket auto-creates via `docker/localstack-init/create-bucket.sh`, but images need re-seeding: `npm run db:seed-images -w packages/db`

---

## Phase 0: Project Scaffolding — ✅ COMPLETE

### Session 1 — Monorepo & Local Environment ✅

- Turborepo monorepo structure (`apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/eslint-config`)
- Docker Compose: PostgreSQL 16 + PostGIS, Redis 7, LocalStack S3
- TypeScript strict mode, ESLint + Prettier, Husky pre-commit hooks
- GitHub Actions CI pipeline (`lint → typecheck → test → build`)
- `.env.example` with all required vars

### Session 2 — Database Schema & Auth Foundation ✅

- **17 Prisma models** migrated: User, Profile, Follow, Album, Photo, PhotoVariant, PhotoTag, PhotoLocation, Airport, SpottingLocation, Comment, Like, Report, Notification, Community, CommunityMember, CommunitySubscription
- JWT auth with mock Cognito middleware (local dev)
- `signUp`, `signIn` mutations, `requireAuth` utility
- Seed scripts: test users (regular, moderator, admin), airports (OurAirports dataset), sample photos with metadata

---

## Phase 1a: Core Build — 🟡 IN PROGRESS

### Session 3 — Profiles & User Pages ✅

- **API:** `me`, `user(username)`, `updateProfile` resolvers + integration tests
- **Pages:** `/signup`, `/signin`, `/settings/profile`, `/u/[username]/photos`
- **Components:** `Header` (with auth state)

### Session 4 — Photo Upload & Display ✅

- **API:** `photo(id)`, `photos(...)` with cursor pagination, `getUploadUrl`, `createPhoto`, `updatePhoto`, `deletePhoto` resolvers + integration tests
- **Services:** `imageProcessing.ts` (Sharp — thumbnail 150px + display 640px), `s3.ts` (presigned URLs, S3 client)
- **Pages:** `/` (home feed, paginated), `/photos/[id]` (detail page), `/upload` (drag-and-drop with metadata form)
- **Components:** `PhotoCard`, `PhotoGrid`

### Session 5 — Albums, Comments, Likes & Follows 🟡

#### ✅ Completed

- **API resolvers + integration tests:** albums (CRUD, add/remove photos), comments (CRUD, threaded replies), likes (toggle), follows (toggle, followers/following queries) — all in `apps/api/src/resolvers/` with tests in `apps/api/src/__tests__/`
- **UI components:** `CommentSection`, `LikeButton`, `FollowButton` — wired with GraphQL mutations
- **Pages:** `/albums` (album listing), `/albums/[id]` (album detail with photo grid)

#### ❌ Not yet built

- `/albums/new` — album creation page
- `/u/[username]/albums` — user's albums tab on profile
- `/feed` — following feed (photos from followed users)
- Album management UI (add/remove photos from existing albums, cover photo selection)
- Like/comment counts displayed on `PhotoCard` in feed/grid views

### Session 6 — Map & Location 🟡

#### ✅ Completed

- **API resolvers + tests:** airport queries (`airport`, `airports` with search)
- **Pages:** `/map` (Mapbox GL JS map page), `/airports/[code]` (airport detail page)
- **Components:** `AirportFollowButton`

#### ❌ Not yet built

- `photosInBounds` / `photosNearby` spatial queries (PostGIS `ST_MakeEnvelope`, `ST_DWithin`)
- Photo markers + clustering on the map (Supercluster)
- Photo location picker in upload flow (manual pin placement, EXIF GPS auto-fill)
- Privacy selector for coordinates (exact / approximate / hidden)
- Spotting location CRUD (create/view spotting locations near airports)
- Spotting locations list on airport pages

### Session 7 — Search, Reporting & Basic Admin 🟡

#### ✅ Completed

- **API resolvers + tests:** search (PostgreSQL `tsvector`/`tsquery`), reports (create report)
- **Pages:** `/search` (search page with results)
- **Components:** `ReportButton`

#### ❌ Not yet built

- Global search bar in `Header` component (currently search is only on `/search` page)
- Admin dashboard — `/admin` (overview: pending reports, flagged photos, user stats)
- Admin reports — `/admin/reports` (report queue with resolve/dismiss actions)
- Admin users — `/admin/users` (user list with role/status management)
- Admin photos — `/admin/photos` (moderation queue with approve/reject)
- Admin route protection middleware (`role === 'admin'`)
- `adminResolveReport`, `adminUpdateUserStatus`, `adminUpdatePhotoModeration` mutations

---

## Phase 1b: Communities — ❌ NOT STARTED

> DB models exist (Community, CommunityMember, CommunitySubscription) but no API resolvers or UI.

- [ ] Community CRUD (create, update, delete, visibility settings)
- [ ] Community pages (public landing page with description, photos, events, members)
- [ ] Membership (join/leave, invite links, approval flow, member directory)
- [ ] Roles (owner, admin, moderator, member)
- [ ] Community-scoped forums (categories, threads, posts)
- [ ] Community-scoped events (create, RSVP, reminders)
- [ ] Community billing (Stripe integration for community tiers)
- [ ] Community discovery (directory, search, location-based)
- [ ] Community-level moderation tools
- [ ] Follows/feed enhancements (community activity in feed)
- [ ] Notification system (in-app + email for likes, comments, follows, community activity)

---

## Phase 2: Launch Prep — ❌ NOT STARTED

- [ ] Individual premium subscriptions (Stripe)
- [ ] Analytics and KPI instrumentation
- [ ] SEO implementation (SSR metadata, sitemaps, structured data, Open Graph tags)
- [ ] Accessibility audit (WCAG 2.1 AA, axe-core integration)
- [ ] Performance tuning and load testing
- [ ] AWS production infrastructure (CDK stacks: RDS, S3, CloudFront, Cognito, Lambda, ECS Fargate)
- [ ] Monitoring, alerting, runbooks
- [ ] Email system (SES: transactional, triggered, digest)

---

## Phase 3: Public Launch — ❌ NOT STARTED

- [ ] Controlled rollout
- [ ] Onboarding flows
- [ ] Community seeding with real spotting groups

---

## Phase 4: Expansion — ❌ NOT STARTED

- [ ] Marketplace listings
- [ ] Enhanced location pages
- [ ] i18n Phase 2 (translations)
- [ ] Advertising integration
- [ ] Flight data widgets

---

## Recommended Next Session Priority

**Finish Phase 1a** — the remaining gaps from Sessions 5–7:

1. **Session 5 completion:** Album create page, user albums tab, following feed, album management UI
2. **Session 6 completion:** Spatial queries, photo markers on map with clustering, location picker in upload, spotting locations
3. **Session 7 completion:** Admin console (reports queue, user management, moderation queue), global search bar in header

After Phase 1a is complete → move to **Phase 1b (Communities)**, which is the core product differentiator and primary revenue model.

---

## File Reference

| Area             | Key Files                                                         |
| ---------------- | ----------------------------------------------------------------- |
| Prisma schema    | `packages/db/prisma/schema.prisma`                                |
| Seed scripts     | `packages/db/prisma/seed.ts`, `packages/db/prisma/seed-images.ts` |
| API entry point  | `apps/api/src/index.ts`                                           |
| GraphQL schema   | `apps/api/src/schema.ts`                                          |
| API resolvers    | `apps/api/src/resolvers/*.ts`                                     |
| API tests        | `apps/api/src/__tests__/*.test.ts`                                |
| Auth utilities   | `apps/api/src/auth/jwt.ts`, `apps/api/src/auth/requireAuth.ts`    |
| Image processing | `apps/api/src/services/imageProcessing.ts`                        |
| S3 service       | `apps/api/src/services/s3.ts`                                     |
| Web app layout   | `apps/web/src/app/layout.tsx`                                     |
| GraphQL client   | `apps/web/src/lib/graphql.ts`, `apps/web/src/lib/providers.tsx`   |
| Shared queries   | `apps/web/src/lib/queries.ts`                                     |
| UI components    | `apps/web/src/components/*.tsx`                                   |
| Docker config    | `docker/docker-compose.yml`                                       |
| LocalStack init  | `docker/localstack-init/create-bucket.sh`                         |
| CI pipeline      | `.github/workflows/ci.yml`                                        |
