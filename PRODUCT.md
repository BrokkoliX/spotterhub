# SpotterHub — Product Documentation

> **Last updated:** 2026-04-17
> **Live at:** https://www.spotterspace.com

---

## What is SpotterHub?

SpotterHub is a community platform for aviation photographers and plane spotters. Users share geotagged photos, organize into communities around airports and aircraft types, discuss in forums, and coordinate events.

---

## Feature Overview

### For All Users

| Feature | Description |
|---------|-------------|
| **Auth** | Email/password signup and sign-in. Mock JWT auth in dev; AWS Cognito in production. |
| **Profiles** | Display name, bio, gear, experience level, interests, favorite aircraft and airports. |
| **Photo Upload** | Drag-and-drop upload with aircraft type, airline, airport, caption, tags, date, location (EXIF GPS or manual pin). Privacy modes: exact / approximate (±500m) / hidden. |
| **Photo Feed** | Paginated home feed of recent approved photos. |
| **Photo Detail** | Full photo with metadata, map pin, comments, likes, related aircraft photos. |
| **Albums** | Personal albums with cover photo selection. Add/remove photos. |
| **Follow Users** | Follow other spotters; follower/following counts. |
| **Map** | Mapbox GL JS map with photo markers clustered via Supercluster. Airport and spotting location pages. |
| **Search** | PostgreSQL full-text search across photos, users, airports. |
| **Global Forum** | Platform-wide discussion categories. Thread list and thread detail with nested replies. Collapse/expand reply threads. |
| **Notifications** | In-app notification bell (polling every 30s). New: likes, comments, follows, community joins, event RSVPs. |
| **Dark / Light Mode** | User-toggleable theme. |

### For Community Members

| Feature | Description |
|---------|-------------|
| **Communities** | Create/join public communities. Each has name, description, banner, category, location. |
| **Community Members** | Role-based membership (owner, admin, moderator, member). Join/leave, invite codes for invite-only communities. |
| **Community Forum** | Per-community forum categories, threads, posts. Pin/lock threads. Soft-delete posts. |
| **Community Albums** | Shared albums within a community. Add photos from personal collection. |
| **Community Events** | Create events with title, description, location, start/end times, capacity. RSVP (going/maybe/not going). Attendee count. |
| **Moderation Log** | Community-level moderation actions (ban, unban, role changes) logged and viewable by admins. |

### For Community Leaders (Owners / Admins)

| Feature | Description |
|---------|-------------|
| **Admin Panel** | `/communities/[slug]/admin` — centralized panel with Overview / Members / Roles / Moderation tabs. |
| **Member Management** | Search members, filter by role/status, paginated list. Ban/unban, kick, change role. Banned members shown separately. |
| **Transfer Ownership** | Transfer community ownership to another member. |
| **Community Settings** | Edit name, description, banner, avatar, category, visibility, location. Regenerate invite code. |

### For Platform Admins (superuser / admin role)

| Feature | Description |
|---------|-------------|
| **Admin Dashboard** | `/admin` — stats overview, quick navigation. |
| **User Management** | `/admin/users` — list with role/status filters, search. Change role/status. |
| **Photo Moderation** | `/admin/photos` — pending/approved/rejected queue with approve/reject actions. |
| **Reports** | `/admin/reports` — flag queue with resolve/dismiss actions. |
| **Site Settings** | `/settings/site` — custom banner and tagline (visible on homepage). |
| **Aircraft Admin** | `/admin/aircraft`, `/admin/manufacturers`, `/admin/families`, `/admin/variants`, `/admin/airlines`, `/admin/aircraft-specific-categories` — full CRUD for aircraft taxonomy. |
| **Airport Admin** | `/admin/airports` — view and manage airports. |
| **Pending List Items** | `/admin/pending-list-items` — manage pending aircraft types, variants, manufacturers, categories. |
| **Email Verification** | Admin can verify user emails. |
| **Password Reset** | Admin can trigger password reset for users. |

---

## User Roles

| Role | Description |
|------|-------------|
| `user` | Regular user — upload photos, join communities, post in forums |
| `moderator` | Can access `/admin` dashboard, review reports and photos |
| `admin` | Full admin access — manage users, photos, site settings, all communities |
| `superuser` | Bypasses ALL role checks — for security oversight; cannot be demoted or banned by non-superusers |

Production superuser: `robi_sz@yahoo.com` / `Jerusalem!25`

---

## Architecture

### Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js (App Router), URQL GraphQL client, CSS Modules |
| **API** | Apollo Server, GraphQL, Prisma ORM |
| **Database** | PostgreSQL 16 + PostGIS, RDS (us-east-1, private subnets) |
| **Frontend container** | ECS Fargate, Next.js standalone output |
| **API container** | ECS Fargate, Node.js 20 Alpine |
| **Load balancer** | AWS ALB (spotterspace-alb) |
| **Image storage** | AWS S3 (spotterspace-photos bucket) |
| **Secrets** | AWS Secrets Manager (`spotterhub/DATABASE_URL`, `spotterhub/JWT_SECRET`) |
| **CDN** | CloudFront |
| **CI/CD** | GitHub Actions (CI: lint → typecheck → test → build; Deploy: Docker build → ECR push → ECS redeploy) |
| **Maps** | Mapbox GL JS |

### Key Files

| Area | Path |
|------|------|
| Frontend monorepo | `apps/web/` |
| API monorepo | `apps/api/` |
| Database schema | `packages/db/prisma/schema.prisma` |
| GraphQL schema | `apps/api/src/schema.ts` |
| API resolvers | `apps/api/src/resolvers/` |
| Frontend queries | `apps/web/src/lib/queries.ts` |
| Generated GraphQL types | `apps/web/src/lib/generated/graphql.ts` |
| Web Docker build | `apps/web/Dockerfile` |
| API Docker build | `apps/api/Dockerfile` |
| API startup (runs migrations) | `apps/api/docker-entrypoint.sh` |

### API Design

- GraphQL endpoint: `POST /api/graphql` (proxied through Next.js rewrite in production)
- Health check: `GET /health` (API), `GET /api/health` (Web)
- Auth: Bearer JWT in `Authorization` header (mock JWT in dev, production uses same flow with real tokens)
- Migrations: run automatically on API container startup via `prisma migrate deploy` (idempotent)

---

## Database

### Key Models

- **User** — cognitoSub, email, username, role, status, emailVerified
- **Profile** — userId, displayName, bio, avatarUrl, locationRegion, experienceLevel, gear, interests, favoriteAircraft, favoriteAirports
- **Photo** — userId, albumId (nullable), caption, airline, airportCode, takenAt, originalUrl, moderationStatus, likeCount, commentCount, msn, manufacturingDate, aircraftId, photographerName, gearBody, gearLens
- **PhotoVariant** — photoId, variantType, url, width, height, fileSizeBytes
- **Album** — userId, communityId (nullable), title, description, coverPhotoId, isPublic
- **AlbumPhoto** — albumId, photoId, addedAt (junction table for community albums)
- **Comment** — userId, photoId (nullable), albumId (nullable), parentCommentId (threaded replies), body, isDeleted
- **Like** — userId, photoId (nullable), albumId (nullable)
- **Follow** — followerId, followingId
- **Airport** — icaoCode, iataCode, name, city, country, latitude, longitude
- **SpottingLocation** — airportId (nullable), name, description, accessNotes, latitude, longitude, createdBy
- **PhotoLocation** — photoId, rawLatitude, rawLongitude, displayLatitude, displayLongitude, privacyMode, airportId, spottingLocationId
- **Community** — slug, name, description, bannerUrl, avatarUrl, category, visibility, location, ownerId, inviteCode
- **CommunityMember** — communityId, userId, role, status, joinedAt
- **CommunityEvent** — communityId, organizerId, title, description, location, startsAt, endsAt, maxAttendees
- **EventAttendee** — eventId, userId, status
- **ForumCategory** — communityId (nullable — null = global forum), name, slug, description, position
- **ForumThread** — categoryId, authorId, title, isPinned, isLocked, postCount, lastPostAt
- **ForumPost** — threadId, authorId, parentPostId (nullable), body, isDeleted, editedAt
- **CommunityModerationLog** — communityId, moderatorId, targetUserId, action, reason, metadata
- **Report** — reporterId, targetType, targetId, reason, description, status, reviewedBy
- **Notification** — userId, type, title, body, data (JSON), isRead
- **AircraftManufacturer**, **AircraftFamily**, **AircraftVariant**, **AircraftSpecificCategory**, **Airline** — aircraft taxonomy for photo metadata
- **SiteSettings** — singleton (id: "site_settings"), bannerUrl, tagline

---

## Deployment

See [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) for full details.

### Live Endpoints

| Endpoint | URL |
|----------|-----|
| Web App | https://www.spotterspace.com |
| API GraphQL | https://api.spotterspace.com/graphql |
| API Health | https://api.spotterspace.com/health |
| Apex Redirect | https://spotterspace.com → www |

### Deploy Flow

Push to `main` → GitHub Actions CI runs (lint → typecheck → test → build) → Docker images built and pushed to ECR → ECS services redeployed automatically.

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `DEPLOYMENT_STATUS.md` | Full deployment, operations, DNS, secrets, troubleshooting |
| `docs/PROJECT_STATUS.md` | Development session log and feature tracking |
| `docs/implementation_plan_phase_0_1a.md` | Historical implementation plan (Phase 0 and Phase 1a sessions) |
| `docs/spotter_portal_production_ready_plan.md` | Original product/architecture specification (foundational reference) |
| `docs/aircraft-photo-fields-v2.md` | Aircraft taxonomy and photo metadata field reference |