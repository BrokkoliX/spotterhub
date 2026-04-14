# SpotterHub — Project Status

> **Last updated:** 2026-04-15 (Session 15)
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

## Phase 1a: Core Build — ✅ COMPLETE

### Session 3 — Profiles & User Pages ✅

- **API:** `me`, `user(username)`, `updateProfile` resolvers + integration tests
- **Pages:** `/signup`, `/signin`, `/settings/profile`, `/u/[username]/photos`
- **Components:** `Header` (with auth state)

### Session 4 — Photo Upload & Display ✅

- **API:** `photo(id)`, `photos(...)` with cursor pagination, `getUploadUrl`, `createPhoto`, `updatePhoto`, `deletePhoto` resolvers + integration tests
- **Services:** `imageProcessing.ts` (Sharp — thumbnail 150px + display 640px), `s3.ts` (presigned URLs, S3 client)
- **Pages:** `/` (home feed, paginated), `/photos/[id]` (detail page), `/upload` (drag-and-drop with metadata form)
- **Components:** `PhotoCard`, `PhotoGrid`

### Session 5 — Albums, Comments, Likes & Follows ✅

- **API resolvers + integration tests:** albums (CRUD, add/remove photos), comments (CRUD, threaded replies), likes (toggle), follows (toggle, followers/following queries) — all in `apps/api/src/resolvers/` with tests in `apps/api/src/__tests__/`
- **UI components:** `CommentSection`, `LikeButton`, `FollowButton` — wired with GraphQL mutations
- **Pages:** `/albums` (album listing with inline create), `/albums/[id]` (album detail with photo grid, add/remove photos modal, cover photo picker in edit modal)
- **Pages:** `/u/[username]/albums` (user albums tab with Photos/Albums tab navigation), `/following` (following feed)
- **Album management:** Add photos modal (`AddPhotosModal`), cover photo selection in album edit, remove photos from albums
- **Note:** Dedicated `/albums/new` page not built (inline creation on `/albums` suffices)

### Session 6 — Map & Location ✅

- **API resolvers + tests:** airport queries (`airport`, `airports` with search), `photosInBounds`/`photosNearby` spatial queries (raw SQL with PostGIS-style bounding box / Haversine), `createSpottingLocation`/`deleteSpottingLocation` mutations
- **API resolver files:** `locationResolvers.ts` (spatial queries), `spottingLocationResolvers.ts` (CRUD)
- **Schema additions:** `PhotoLocation` type (with nested airport/spottingLocation), `PhotoMapMarker` type, `CreateSpottingLocationInput`, location fields on `CreatePhotoInput`/`UpdatePhotoInput` (latitude, longitude, locationPrivacy)
- **Privacy:** `applyPrivacy()` helper in photoResolvers — exact (pass-through), approximate (~1km random offset), hidden (zeroed display coords, excluded from queries)
- **Photo resolvers:** `createPhoto`/`updatePhoto` create/upsert `PhotoLocation` rows with privacy-aware display coordinates; `Photo.location` field resolver returns display coords with nested airport/spottingLocation
- **Pages:** `/map` (Mapbox GL JS map with airport markers + photo markers via Supercluster clustering), `/airports/[code]` (airport detail with spotting location list, add/delete form)
- **Upload page:** Location picker (lat/lng number inputs), privacy selector (exact/approximate/hidden)
- **Photo detail page:** Location card with static Mapbox map, airport link, spotting location name, privacy badge
- **Components:** `AirportFollowButton`
- **Tests:** `location.test.ts` — photosInBounds, photosNearby, createSpottingLocation, deleteSpottingLocation (ownership checks, auth guards)

### Session 7 — Search, Reporting & Admin ✅

- **API resolvers + tests:** search (PostgreSQL `tsvector`/`tsquery`), reports (create report), admin queries/mutations (`adminStats`, `adminReports`, `adminUsers`, `adminPhotos`, `adminResolveReport`, `adminUpdateUserStatus`, `adminUpdateUserRole`, `adminUpdatePhotoModeration`) — 19 integration tests in `admin.test.ts`
- **Admin role guards:** `requireAdmin` helper (admin + moderator for queries; admin-only for user status/role mutations)
- **Pages:** `/search` (search page with results, reads `?q=` from URL), `/admin` (dashboard with stats grid + quick links), `/admin/reports` (report queue with resolve/dismiss), `/admin/users` (user list with role/status management, filters by role/status/search), `/admin/photos` (moderation queue with approve/reject, filter by status)
- **Components:** `ReportButton`, global search bar in `Header` (Enter navigates to `/search?q=...`), admin nav link (visible to admin/moderator users)
- **Resolver files:** `adminResolvers.ts` (admin queries + mutations)

---

## Phase 1b: Communities — ✅ COMPLETE

### Session 8 — Community CRUD, Membership & Discovery ✅

- **DB:** Added `slug` field (unique) to `Community` model + migration
- **API resolvers + tests (32 integration tests in `community.test.ts`):**
  - Community CRUD: `createCommunity` (with slug validation, auto invite code for invite-only), `updateCommunity` (owner/admin only), `deleteCommunity` (owner only)
  - Queries: `community(slug)` (with myMembership, member list pagination), `communities(search, category, first, after)` (public discovery with cursor pagination, search across name/description, category filter), `myCommunities`
  - Membership: `joinCommunity` (public auto-join, invite-only with code validation), `leaveCommunity` (prevents owner from leaving), `removeCommunityMember` (owner/admin/moderator only), `updateCommunityMemberRole` (owner/admin can promote to member/moderator/admin, cannot assign owner), `generateInviteCode` (owner/admin only, regenerates 12-char code)
  - Field resolvers: `Community.owner`, `Community.memberCount`, `Community.members` (paginated), `Community.myMembership`, `Community.inviteCode` (only visible to owner/admin)
- **Resolver file:** `apps/api/src/resolvers/communityResolvers.ts`
- **Pages:** `/communities` (discovery directory with search + category filter + grid), `/communities/new` (create form with auto-slug), `/communities/[slug]` (community landing with banner, info, join/leave, member list with role badges)
- **Components:** `RoleBadge` (color-coded owner/admin/moderator/member), Communities nav link in Header
- **CSS:** `apps/web/src/app/communities/page.module.css`

### Session 9 ✅: Community Forums

- **DB:** `ForumCategory`, `ForumThread`, `ForumPost` models in Prisma schema + migration `20260409174943_add_community_forums`
  - ForumCategory: community-scoped, slug-unique-per-community, position ordering
  - ForumThread: pinned/locked flags, denormalized postCount + lastPostAt for efficient listing
  - ForumPost: soft-delete (isDeleted), nested replies (self-referential parentPostId), cascade on thread delete
- **API:** Full GraphQL layer in `apps/api/src/resolvers/forumResolvers.ts`
  - 5 queries: `forumCategories`, `forumCategory`, `forumThreads` (paginated, pinned-first), `forumThread`, `forumPosts` (paginated, top-level only)
  - 10 mutations: category CRUD (owner/admin), thread CRUD + pin/lock (member/moderator), post CRUD with soft-delete + 24h edit window
  - Field resolvers: `threadCount`, `latestThread`, `author`, `category`, `firstPost`, `replies`
  - Auth: active-membership guard, role-weight helper (owner=4, admin=3, moderator=2, member=1)
  - Wired into `apps/api/src/schema.ts` + `apps/api/src/resolvers.ts`
- **Tests:** 35 integration tests in `apps/api/src/__tests__/forum.test.ts` — all passing (240/241 total, 1 pre-existing search flake)
- **UI:** Forum tab on community detail page → `/communities/[slug]/forum`
  - `/communities/[slug]/forum/page.tsx` — category list; owner/admin can create/delete categories via modal
  - `/communities/[slug]/forum/[categorySlug]/page.tsx` — thread list (pinned first, with post count + last-activity); members can create threads; moderators can pin/lock/delete
  - `/communities/[slug]/forum/[categorySlug]/[threadId]/page.tsx` — thread detail with breadcrumb nav, post list (with nested replies), inline edit, soft-delete, reply composer; locked-thread state handled gracefully
- **Queries:** All forum GQL operations added to `apps/web/src/lib/queries.ts`

### Session 10 ✅: Community Events

- **DB:** `CommunityEvent` + `EventAttendee` models + `EventRsvpStatus` enum (going/maybe/not_going) in Prisma schema + migration `20260409191825_add_community_events`
  - `CommunityEvent`: communityId, organizerId, title, description, location, startsAt, endsAt (optional), maxAttendees (optional capacity limit), coverUrl; index on `[communityId, startsAt]`
  - `EventAttendee`: `@@unique([eventId, userId])` — upsert-safe RSVP; cascade deletes on event/user
  - Back-relations: `Community.events`, `User.organizedEvents`, `User.eventAttendances`
- **API:** Full GraphQL layer in `apps/api/src/resolvers/eventResolvers.ts`
  - 2 queries: `communityEvents(communityId, first, after, includePast)` — cursor-paginated, upcoming-only by default (OR filter: endsAt≥now OR (endsAt=null AND startsAt≥now)); `communityEvent(id)`
  - 5 mutations: `createCommunityEvent` (owner/admin), `updateCommunityEvent` (organizer or admin), `deleteCommunityEvent` (organizer or admin), `rsvpEvent` (active member, capacity enforced for 'going' only), `cancelRsvp` (idempotent)
  - Field resolvers: `organizer`, `attendeeCount` (going only), `myRsvp` (per-user RSVP), `isFull` (maxAttendees enforcement), `startsAt`/`endsAt`/`createdAt`/`updatedAt` ISO serializers
  - `EventAttendee` field resolvers: `user`, `joinedAt`
  - Wired into `apps/api/src/schema.ts` + `apps/api/src/resolvers.ts`
- **Tests:** 32 integration tests in `apps/api/src/__tests__/event.test.ts` — all passing (272 total across 15 test files when run individually)
- **UI:**
  - Events tab on community detail page (`/communities/[slug]`) with preview of upcoming events (up to 5)
  - `/communities/[slug]/events` — full event list (upcoming/past toggle), admin "Create Event" modal (title, description, location, startsAt, endsAt, maxAttendees), delete button for admins
  - `/communities/[slug]/events/[eventId]` — event detail with formatted date/time, organizer link, description, RSVP section (Going/Maybe/Can't Go buttons with active highlight, capacity badge, full indicator), inline edit form for organizer
- **Queries:** All 7 event GQL operations added to `apps/web/src/lib/queries.ts`

### Session 11 ✅: In-App Notification System

- **DB:** Extended `NotificationType` enum with `community_join` + `community_event` values via migration `20260409195436_extend_notification_types`
- **API:** Full notification GraphQL layer in `apps/api/src/resolvers/notificationResolvers.ts`
  - 2 queries: `notifications(first, after, unreadOnly)` — cursor-paginated newest-first, viewer's own only; `unreadNotificationCount` — safe for unauthenticated (returns 0)
  - 3 mutations: `markNotificationRead(id)`, `markAllNotificationsRead`, `deleteNotification(id)` — all ownership-checked
  - Exported `createNotification(prisma, { userId, type, title, body?, data? })` helper — fire-and-forget, swallows errors silently
  - `scalar JSON` declared in schema + pass-through scalar resolver in `resolvers.ts`
- **Notification triggers** wired into 5 existing mutations:
  - `likePhoto` → ❤️ like notification to photo owner (skips self-likes)
  - `addComment` → 💬 comment notification to photo owner (skips self-comments)
  - `followUser` → 👤 follow notification to followed user
  - `joinCommunity` → 🏘️ join notification to community owner (skips if joiner is owner)
  - `rsvpEvent` (going only) → 📅 RSVP notification to event organizer (skips self)
- **Tests:** 14 integration tests in `apps/api/src/__tests__/notification.test.ts` — all passing (286 total across 16 test files when run individually)
- **Web queries:** 5 operations added to `apps/web/src/lib/queries.ts`: `GET_NOTIFICATIONS`, `GET_UNREAD_COUNT`, `MARK_NOTIFICATION_READ`, `MARK_ALL_NOTIFICATIONS_READ`, `DELETE_NOTIFICATION`
- **UI:** `NotificationBell` component added to `Header.tsx`
  - Polls `unreadNotificationCount` every 30s (network-only), shows red badge (capped at "9+")
  - Click opens a 320px dropdown fetching last 10 notifications
  - Unread items highlighted with accent border; "Mark all read" button; click navigates by `data.photoId` → `/photos/{id}` or `/communities`
  - Closes on outside click via `useEffect` + `document.addEventListener`
  - CSS added to `Header.module.css`

### Session 13 ✅ (2026-04-11): AWS App Runner Deployment Infrastructure

**Changes committed:** `62a8147`

- **API container:** Express wrapper added to `apps/api/src/index.ts` (Apollo Server now runs behind Express with `GET /health` endpoint for App Runner health checks). Added `express` + `@types/express` dependencies.
- **API Dockerfile** (`apps/api/Dockerfile`): Multi-stage Node 20 Alpine build — compiles TypeScript, runs `prisma generate`, prunes devDependencies, copies prisma schema for migrate deploy.
- **API entrypoint** (`apps/api/docker-entrypoint.sh`): Fetches `DATABASE_URL` and `JWT_SECRET` from AWS Secrets Manager at startup, runs `prisma migrate deploy` (idempotent), starts Node server.
- **Web Dockerfile** (`apps/web/Dockerfile`): Multi-stage Next.js standalone build — builds standalone output, copies static assets.
- **Next.js config** (`apps/web/next.config.ts`): Added `output: 'standalone'` and S3 production `remotePatterns` for `spotterspace-photos.s3.us-east-1.amazonaws.com`.
- **CDK infrastructure stack** (`infrastructure/`): VPC, RDS PostgreSQL 16 (t3.micro/t3.small), Secrets Manager for DATABASE_URL + JWT_SECRET, ECR repositories, App Runner services (API on port 4000, Web on port 3000 with NEXT_PUBLIC_API_URL wired to API URL).
- **GitHub Actions deploy workflow** (`.github/workflows/deploy.yml`): Triggers on push to `main` — CDK deploy → Docker build/push API to ECR → Docker build/push Web to ECR → App Runner redeploy.

**Not included** (deferred): Cognito auth wiring, CloudFront CDN, production S3 bucket creation, Lambda.

### Session 14 ✅ (2026-04-14): App Runner Deployment — Custom Domain & HTTPS (ALL WORKING)

**What's deployed (CDK-managed `SpotterSpace-dev-Stack`):**

| Component | Status | Details |
|-----------|--------|---------|
| App Runner service (web) | ✅ RUNNING | `wjigqzbc7x.us-east-1.awsapprunner.com` |
| App Runner service (api) | ✅ RUNNING | `japveibkai.us-east-1.awsapprunner.com` |
| CloudFront distribution | ✅ DEPLOYED | `d1yo7g0mlwprtw.cloudfront.net` (CDK-managed) |
| VPC Connector | ✅ Created | `spotterspace-dev-vpc-connector` in private subnets |
| ECR repos | ✅ Created | `spotterspace-dev-web`, `spotterspace-dev-api` |
| Secrets Manager | ✅ Connected | `spotterspace/DATABASE_URL`, `spotterspace/JWT_SECRET` |

**DNS & HTTPS (all endpoints confirmed working):**

| Endpoint | Status | Notes |
|----------|--------|-------|
| `https://www.spotterspace.com/` | ✅ HTTP 200 | CNAME → Web App Runner |
| `https://api.spotterspace.com/graphql` | ✅ HTTP 200 | CNAME → API App Runner |
| `https://api.spotterspace.com/health` | ✅ HTTP 200 | Health check endpoint |
| `https://spotterspace.com/` | ✅ HTTP 301 | CloudFront Function → redirects to www |

**Root domain (apex) redirect — FIXED:**
- Apex `spotterspace.com` → CloudFront distribution → CloudFront Function (inline JS) → 301 → `https://www.spotterspace.com`
- CloudFront distribution, ACM certificate, CloudFront Function, and Route 53 DNS records are all managed as IaC in `infrastructure/lib/spotterspace-stack.ts`
- Gated by `domainName` + `hostedZoneId` props — only deployed when those env vars are set

**Critical Dockerfile fix (nested Next.js standalone structure):**
- Next.js standalone output has `server.js` at `standalone/apps/web/server.js` (nested one level deeper than expected)
- Dockerfile must copy standalone to `/app/apps/web` and static files to `/app/apps/web/apps/web/.next/static`
- CMD must be `["node", "apps/web/apps/web/server.js"]`
- This was causing CSS/JS 404s on the live site — static files in wrong path

**AWS CDK Resources created (`SpotterSpace-dev-Stack`):**
- VPC Connector (`spotterspace-dev-vpc-connector`) in private subnets
- App Runner: `spotterspace-dev-api` (port 4000, VPC egress, IAM role for Secrets + S3)
- App Runner: `spotterspace-dev-web` (port 3000, public egress, `NEXT_PUBLIC_API_URL` wired)
- CloudFront distribution + ACM certificate (`*.spotterspace.com`)
- Route 53 records: A alias (apex→CF), CNAME (www→web), CNAME (api→api)
- IAM roles: `spotterspace-dev-apprunner-access` (ECR pull), `spotterspace-dev-api-instance` (secrets + S3)

**Files changed:**
- `apps/web/Dockerfile` — fixed static file paths and CMD for nested standalone structure
- `infrastructure/lib/spotterspace-stack.ts` — full CDK stack: VPC Connector, App Runner services, CloudFront + ACM + Route 53 (gated by domain props), IAM roles
- `infrastructure/bin/spotterspace.ts` — reads `STAGE`, `DOMAIN_NAME`, `HOSTED_ZONE_ID`, `VPC_ID` from env
- `.github/workflows/deploy.yml` — CDK bootstrap + deploy → Docker build/push API → Docker build/push Web → App Runner redeploy
- `DEPLOYMENT_STATUS.md` — comprehensive deployment reference (see that file for all manual commands)

### Session 15 ✅ (2026-04-15): ECS Fargate — ALB Health Check Fix

**Problem:** After migrating from App Runner to ECS Fargate + ALB, ALB health checks timed out on every redeployment. Both target groups showed targets as `unhealthy` with reason `Target.Timeout`, returning 504s.

**Root cause:** The ECS `CfnService` definitions were missing `loadBalancers` configuration. Without this, ECS does not automatically register task IPs with the ALB target groups. Every time tasks restarted after a CDK redeploy, new IPs were assigned but never registered — the ALB had no healthy targets to forward to.

**Fix applied:**
1. Added `loadBalancers` property to both API and Web `CfnService` definitions, linking each service to its respective target group. ECS now automatically registers/deregisters task IPs on deploy.
2. Added explicit `addDependency()` calls so ECS services are created only after the ALB listeners and target groups exist in CloudFormation, preventing deployment race conditions.

**Verified (post-deploy):**
- API target group: `10.0.1.55:4000` → **healthy**
- Web target group: `10.0.2.36:3000` → **healthy**
- `https://api.spotterspace.com/health` → HTTP 200 ✅
- `https://www.spotterspace.com` → HTTP 200 ✅

**Files changed:**
- `infrastructure/lib/spotterspace-stack.ts` — added `loadBalancers` to both ECS services + dependency ordering
- `infrastructure/TROUBLESHOOTING.md` — documented root cause and resolution

---

### Session 12 ✅: Global Forum, Site Settings, Superuser & UX Polish

**Schema additions:**
- `UserRole` enum: added `superuser` role
- `ForumCategory.communityId` → optional (null = site-wide global category)
- `SiteSettings` singleton model (id: "site_settings", bannerUrl, tagline)
- `Photo.likeCount` Int field with default 0 (for efficient sort by popularity)

**API:**
- **Superuser role:** bypasses ALL role-based access controls across all resolvers
  - `requireRole()` auto-bypasses for superuser (no JWT claim changes needed — always does DB lookup)
  - Direct role checks updated: `siteSettingsResolvers`, `forumResolvers.requireAdmin`, `adminResolvers`, `communityResolvers` (update/remove/generate code/member role), `communityModerationResolvers` (ban/unban/view logs), `albumResolvers` (create/edit/delete community albums), `eventResolvers` (create/update/delete)
  - Superuser protected from role/status changes by non-superusers via `adminUpdateUserRole`/`adminUpdateUserStatus`
- **Global forum:** `globalForumCategories` query, `createGlobalForumCategory` mutation (superuser/admin only)
- **Site settings:** `siteSettings` query (public), `updateSiteSettings` mutation (admin/superuser only) via `siteSettingsResolvers.ts`
- **Superuser content bypass:** community photos field returns all approved photos for superuser without membership filter

**Frontend:**
- **Global forum pages:** `/forum` (category list with hero), `/forum/[slug]` (thread list), `/forum/[slug]/[threadId]` (thread detail with posts + reply composer)
- **Site settings:** `/settings/site` — admin-only page with banner upload (S3) and tagline editor
- **Homepage:** hero shows custom banner/tagline from `siteSettings` when set
- **Communities page:** redesigned with magazine grid (hero banner, featured card, 3-col grid, search + category filter)
- **Community page:** inline click-to-change banner overlay in hero section for admin/superuser
- **`/communities/new`:** redesigned with centered card layout, breadcrumb, inline slug preview
- **Header:** "Forum" nav link, "My Uploads" label (was "Upload"), 🛡️ badge for superuser, Admin link visible to superuser
- **Album detail:** community album "Add Photos" → "Add from My Photos"; superuser sees Add Photos without membership
- **`ImageUploader` component:** refactored to use S3 presigned URLs (not local FileReader data URLs); exposes `triggerUpload()` via `forwardRef`/`useImperativeHandle`

---

## Phase 2: Launch Prep — 🔄 IN PROGRESS

- [ ] Individual premium subscriptions (Stripe)
- [ ] Analytics and KPI instrumentation
- [ ] SEO implementation (SSR metadata, sitemaps, structured data, Open Graph tags)
- [ ] Accessibility audit (WCAG 2.1 AA, axe-core integration)
- [ ] Performance tuning and load testing
- [x] ~~AWS production infrastructure (CDK stacks: RDS, S3, CloudFront, Cognito, Lambda, ECS Fargate)~~ — **Partially done** (Sessions 13-14): App Runner, VPC, RDS, Secrets Manager, ECR, CloudFront. Remaining: Cognito auth wiring, production S3, Lambda, monitoring/alerting
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

**Phase 1a and Phase 1b are complete. AWS deployment is live on ECS Fargate + ALB.**

**Sessions 13-15 done:** Deployment infrastructure (Dockerfiles, CDK stack, GitHub Actions deploy workflow, DNS/HTTPS, ECS Fargate + ALB with auto target registration).

**Next — Phase 2 Launch Prep:**
1. **Cognito auth** — wire `signUp`/`signIn` resolvers to AWS Cognito (currently mock JWT in dev)
2. **Configure GitHub secrets/variables:**
   - **Secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `JWT_SECRET_INITIAL_VALUE`, `NEXT_PUBLIC_MAPBOX_TOKEN`
   - **Variables:** `AWS_ACCOUNT_ID`, `S3_BUCKET_NAME`, `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`, `DOMAIN_NAME` (`spotterspace.com`), `HOSTED_ZONE_ID` (`Z00113712EMKXVCPQFWZW`), `VPC_ID` (`vpc-09a6870488b73260e`)
3. **Merge to main** to trigger first CI/CD deploy (CDK + Docker build/push + ECS redeploy)
4. SEO implementation (metadata, sitemaps, Open Graph)
5. Monitoring & alerting (CloudWatch dashboards, alarms for target health, error rates)

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
| Auth utilities   | `apps/api/src/auth/jwt.ts`, `apps/api/src/auth/requireAuth.ts`     |
| Image processing | `apps/api/src/services/imageProcessing.ts`                        |
| S3 service       | `apps/api/src/services/s3.ts`                                     |
| Web app layout   | `apps/web/src/app/layout.tsx`                                     |
| GraphQL client   | `apps/web/src/lib/graphql.ts`, `apps/web/src/lib/providers.tsx`   |
| Shared queries   | `apps/web/src/lib/queries.ts`                                     |
| UI components    | `apps/web/src/components/*.tsx`                                  |
| Docker config    | `docker/docker-compose.yml`                                       |
| LocalStack init  | `docker/localstack-init/create-bucket.sh`                         |
| CI pipeline      | `.github/workflows/ci.yml`                                        |
| Deploy workflow  | `.github/workflows/deploy.yml`                                    |
| API Dockerfile   | `apps/api/Dockerfile`                                            |
| API entrypoint   | `apps/api/docker-entrypoint.sh`                                   |
| Web Dockerfile   | `apps/web/Dockerfile`                                            |
| CDK app          | `infrastructure/bin/spotterspace.ts`                                |
| CDK stack        | `infrastructure/lib/spotterspace-stack.ts`                          |

---

## User Roles Reference

| Role       | Description                                                      |
| ---------- | ---------------------------------------------------------------- |
| `user`     | Regular user — can follow, upload, join public communities       |
| `moderator`| Can access `/admin` dashboard, review reports and photos        |
| `admin`    | Full admin access; can manage users, photos, site settings      |
| `superuser`| Bypasses ALL role checks — for security oversight; cannot be demoted/banned by non-superusers |
