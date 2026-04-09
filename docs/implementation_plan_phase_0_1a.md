# Implementation Plan — Phase 0 + Phase 1a

Session-by-session engineering blueprint for SpotterHub. This document covers scaffolding through a working private alpha with the core upload-and-browse loop.

**Timeline:** ~2–4 weeks (AI-driven development compresses calendar time significantly)
**Development model:** All code written by AI (Tabnine CLI), directed and reviewed by founder
**Environment:** Local Docker Compose → AWS staging later

### AI development principles

- **Sessions, not sprints.** Each numbered section below is a focused implementation session. Sessions are completed sequentially — each one produces working, tested code before moving to the next.
- **Tests are the quality gate.** Since all code is AI-generated, comprehensive automated tests (unit, integration, E2E) are mandatory — they're how the founder verifies correctness without reading every line.
- **Code quality over speed.** Strong typing, clear abstractions, and thorough inline documentation (JSDoc on all public functions, GraphQL descriptions on all types/fields) so the codebase is maintainable by the founder or future developers.
- **Validate after every session.** Each session ends with: all tests green, `docker compose up` works, and the founder can manually verify the new functionality.
- **Atomic commits.** Each session produces a logical, reviewable set of commits the founder can inspect via `git log` and `git diff`.

---

## Phase 0: Project Scaffolding

### Session 1 — Monorepo & Local Environment

**Goal:** A running local dev environment with all containers, linting, and CI.

#### Tasks

1. **Initialize Turborepo monorepo**

   ```
   spotterhub/
   ├── apps/
   │   ├── web/          # Next.js (App Router, TypeScript)
   │   └── api/          # Apollo Server (TypeScript)
   ├── packages/
   │   ├── shared/       # Shared types, constants, validation schemas
   │   ├── db/           # Prisma schema, migrations, seed scripts
   │   └── eslint-config/ # Shared ESLint config
   ├── docker/
   │   ├── Dockerfile.web
   │   ├── Dockerfile.api
   │   └── docker-compose.yml
   ├── .github/
   │   └── workflows/
   │       └── ci.yml
   ├── turbo.json
   ├── package.json
   └── .env.example
   ```

2. **Docker Compose services**
   - PostgreSQL 16 with PostGIS extension
   - Redis 7
   - LocalStack (S3 emulation) — or use local filesystem with an abstraction
   - API container (hot reload)
   - Web container (hot reload)

3. **Tooling setup**
   - TypeScript (strict mode) across all packages
   - ESLint + Prettier (shared config)
   - `next-intl` wired up with English message keys (i18n readiness)
   - Husky + lint-staged for pre-commit checks

4. **CI pipeline (GitHub Actions)**
   - On PR: lint → type-check → test → build
   - Turbo caching enabled
   - No deployment yet — just validation

5. **Environment config**
   - `.env.example` with all required vars
   - `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`, `S3_ENDPOINT`, `COGNITO_*`, `MAPBOX_TOKEN`
   - All service connections via env vars (local ↔ AWS swap)

**Exit criteria:** `docker compose up` starts all services; `turbo lint` and `turbo build` pass; CI runs green on GitHub.

---

### Session 2 — Database Schema & Auth Foundation

**Goal:** Core database tables and working auth flow.

#### Database schema (Prisma)

Design and migrate the Phase 1a tables. Communities and billing tables are included in the schema but not exposed in the API yet.

**Core tables for Phase 1a:**

```
users
  - id (UUID, PK)
  - cognito_sub (unique)
  - email (unique)
  - username (unique)
  - role (enum: user, moderator, admin)
  - status (enum: active, suspended, banned)
  - created_at, updated_at

profiles
  - id (UUID, PK)
  - user_id (FK → users, unique)
  - display_name
  - bio (text)
  - avatar_url
  - location_region
  - experience_level (enum)
  - gear (text)
  - interests (text[])
  - favorite_aircraft (text[])
  - favorite_airports (text[])
  - is_public (boolean, default true)
  - created_at, updated_at

follows
  - id (UUID, PK)
  - follower_id (FK → users)
  - following_id (FK → users)
  - created_at
  - unique(follower_id, following_id)

albums
  - id (UUID, PK)
  - user_id (FK → users)
  - community_id (FK → communities, nullable) -- ready for Phase 1b
  - title
  - description
  - cover_photo_id (FK → photos, nullable)
  - is_public (boolean, default true)
  - created_at, updated_at

photos
  - id (UUID, PK)
  - user_id (FK → users)
  - album_id (FK → albums, nullable)
  - caption (text)
  - aircraft_type
  - airline
  - airport_code
  - taken_at (timestamp)
  - original_url
  - original_width, original_height
  - file_size_bytes
  - mime_type
  - moderation_status (enum: pending, approved, rejected, review)
  - moderation_labels (jsonb)
  - moderation_confidence (float)
  - created_at, updated_at

photo_variants
  - id (UUID, PK)
  - photo_id (FK → photos)
  - variant_type (enum: thumbnail, display, full_res, watermarked)
  - url
  - width, height
  - file_size_bytes
  - created_at

photo_tags
  - id (UUID, PK)
  - photo_id (FK → photos)
  - tag (text, indexed)
  - created_at

photo_locations
  - id (UUID, PK)
  - photo_id (FK → photos, unique)
  - raw_latitude (float8)
  - raw_longitude (float8)
  - display_latitude (float8)
  - display_longitude (float8)
  - privacy_mode (enum: exact, approximate, hidden)
  - airport_id (FK → airports, nullable)
  - spotting_location_id (FK → spotting_locations, nullable)
  - geom (PostGIS geometry, SRID 4326) -- indexed
  - created_at, updated_at

airports
  - id (UUID, PK)
  - icao_code (unique)
  - iata_code (unique, nullable)
  - name
  - city
  - country
  - latitude (float8)
  - longitude (float8)
  - geom (PostGIS geometry)
  - created_at

spotting_locations
  - id (UUID, PK)
  - airport_id (FK → airports, nullable)
  - name
  - description (text)
  - access_notes (text)
  - latitude (float8)
  - longitude (float8)
  - geom (PostGIS geometry)
  - created_by (FK → users)
  - created_at, updated_at

comments
  - id (UUID, PK)
  - user_id (FK → users)
  - photo_id (FK → photos, nullable)
  - album_id (FK → albums, nullable)
  - parent_comment_id (FK → comments, nullable) -- threaded replies
  - body (text)
  - created_at, updated_at

likes
  - id (UUID, PK)
  - user_id (FK → users)
  - photo_id (FK → photos, nullable)
  - album_id (FK → albums, nullable)
  - comment_id (FK → comments, nullable)
  - created_at
  - unique(user_id, photo_id), unique(user_id, album_id), unique(user_id, comment_id)

reports
  - id (UUID, PK)
  - reporter_id (FK → users)
  - target_type (enum: photo, comment, profile, album)
  - target_id (UUID)
  - reason (enum: inappropriate, spam, harassment, copyright, other)
  - description (text)
  - status (enum: open, reviewed, resolved, dismissed)
  - reviewed_by (FK → users, nullable)
  - created_at, resolved_at

notifications
  - id (UUID, PK)
  - user_id (FK → users)
  - type (enum: like, comment, follow, mention, moderation, system)
  - title
  - body (text)
  - data (jsonb) -- flexible payload for deep links
  - is_read (boolean, default false)
  - created_at
```

**Schema-only (for Phase 1b, not exposed yet):**

```
communities
community_members
community_subscriptions
user_subscriptions
forum_categories
forum_threads
forum_posts
events
event_attendees
moderation_actions
```

#### Auth setup

1. **Cognito integration**
   - For local dev: use a JWT mock middleware that simulates Cognito tokens
   - Auth context middleware on Apollo Server: extract user from JWT, attach to GraphQL context
   - Three mutations: `signUp`, `signIn`, `resetPassword` (proxy to Cognito SDK)
   - Protected resolver pattern: `requireAuth(context)` utility that throws if unauthenticated

2. **Seed script**
   - Create test users (regular, moderator, admin)
   - Seed airports table from OurAirports CSV (free dataset, ~7K airports with ICAO/IATA codes)
   - Create sample photos, albums, comments for development

**Exit criteria:** Database migrated with all Phase 1a tables; auth flow works end-to-end (sign up → sign in → access protected resolver); airports seeded; seed data loadable.

---

## Phase 1a: Core Build

### Session 3 — Profiles & User Pages

**Goal:** Users can sign up, create/edit their profile, and view other profiles.

#### API (GraphQL)

```graphql
type Query {
  me: User!
  user(username: String!): User
  users(first: Int, after: String): UserConnection!
}

type Mutation {
  updateProfile(input: UpdateProfileInput!): Profile!
  updateAvatar(input: UpdateAvatarInput!): Profile!
}
```

#### Frontend pages

| Page           | Route               | Description                       |
| -------------- | ------------------- | --------------------------------- |
| Sign up        | `/signup`           | Email/password registration form  |
| Sign in        | `/signin`           | Login form                        |
| My profile     | `/settings/profile` | Edit profile form                 |
| Public profile | `/u/[username]`     | View user profile, photos, albums |

#### Key implementation details

- Profile edit form with all fields (bio, gear, interests, favorites, region)
- Avatar upload → S3 (local filesystem in dev) → display via CDN URL
- Username validation (unique, URL-safe, 3–30 chars)
- `next-intl` message keys for all UI strings
- Semantic HTML, keyboard navigation, WCAG color contrast

#### Tests

- Unit: profile validation, username rules
- Integration: sign up → update profile → fetch public profile
- E2E (Playwright): sign up flow, profile edit, view other user

---

### Session 4 — Photo Upload & Display

**Goal:** Users can upload photos with metadata and view them.

#### API (GraphQL)

```graphql
type Query {
  photo(id: ID!): Photo
  photos(
    first: Int
    after: String
    userId: ID
    albumId: ID
    aircraftType: String
    airportCode: String
    tags: [String!]
  ): PhotoConnection!
}

type Mutation {
  getUploadUrl(input: GetUploadUrlInput!): UploadUrlPayload!
  createPhoto(input: CreatePhotoInput!): Photo!
  updatePhoto(id: ID!, input: UpdatePhotoInput!): Photo!
  deletePhoto(id: ID!): Boolean!
}
```

#### Upload flow (local dev version)

```
1. Client calls getUploadUrl → API returns signed URL (or local path in dev)
2. Client uploads directly to S3/local storage
3. Client calls createPhoto with metadata + S3 key
4. API creates photo record (moderation_status: approved in dev, pending in prod)
5. In dev: synchronous Sharp processing (thumbnail + display variant)
   In prod: S3 event → Lambda → Sharp + Rekognition
6. Photo becomes visible
```

#### Image processing (local dev)

- Use Sharp directly in the API for dev (no Lambda needed locally)
- Generate: thumbnail (150px), display (640px for free, 2048px for premium)
- Extract EXIF: GPS coordinates, camera model, date taken
- Store variants in local filesystem (mapped via Docker volume)
- Abstract behind `ImageProcessingService` interface (local impl vs Lambda impl)

#### Frontend pages

| Page         | Route                  | Description                                      |
| ------------ | ---------------------- | ------------------------------------------------ |
| Upload       | `/upload`              | Drag-and-drop upload with metadata form          |
| Photo detail | `/photos/[id]`         | Full photo view with metadata, map pin, comments |
| User photos  | `/u/[username]/photos` | Grid of user's photos                            |
| Photo feed   | `/` (home)             | Paginated feed of recent photos                  |

#### Key implementation details

- Drag-and-drop upload with progress bar
- Metadata form: caption, aircraft type, airline, airport (autocomplete from seeded airports), tags, date
- EXIF auto-fill: if GPS data exists, auto-populate coordinates; if camera date exists, auto-populate date
- Photo detail page with `next/image` for responsive delivery
- Tier-based upload validation: check monthly upload count and file size against user tier
- SSR for photo detail pages (SEO: title, description, Open Graph from metadata)

#### Tests

- Unit: EXIF parser, tier limit validation, file type validation
- Integration: upload flow → create photo → fetch with variants
- E2E: upload a photo, verify it appears in feed and on profile

---

### Session 5 — Albums, Comments, Likes & Follows

**Goal:** Users can organize photos into albums, comment on photos, and like content.

#### API (GraphQL)

```graphql
# Albums
type Query {
  album(id: ID!): Album
  albums(userId: ID, first: Int, after: String): AlbumConnection!
}

type Mutation {
  createAlbum(input: CreateAlbumInput!): Album!
  updateAlbum(id: ID!, input: UpdateAlbumInput!): Album!
  deleteAlbum(id: ID!): Boolean!
  addPhotosToAlbum(albumId: ID!, photoIds: [ID!]!): Album!
  removePhotosFromAlbum(albumId: ID!, photoIds: [ID!]!): Album!
}

# Comments
type Query {
  comments(photoId: ID, albumId: ID, first: Int, after: String): CommentConnection!
}

type Mutation {
  createComment(input: CreateCommentInput!): Comment!
  updateComment(id: ID!, body: String!): Comment!
  deleteComment(id: ID!): Boolean!
}

# Likes
type Mutation {
  toggleLike(input: ToggleLikeInput!): LikeResult!
}

# Follows
type Mutation {
  toggleFollow(userId: ID!): FollowResult!
}

type Query {
  followers(userId: ID!, first: Int, after: String): UserConnection!
  following(userId: ID!, first: Int, after: String): UserConnection!
  feed(first: Int, after: String): PhotoConnection!
}
```

#### Frontend pages

| Page           | Route                  | Description                                  |
| -------------- | ---------------------- | -------------------------------------------- |
| Album detail   | `/albums/[id]`         | Album with photo grid, description, comments |
| User albums    | `/u/[username]/albums` | List of user's albums                        |
| Create album   | `/albums/new`          | Album creation form                          |
| Following feed | `/feed`                | Photos from followed users                   |

#### Key implementation details

- Album creation with title, description, cover photo selection
- Add/remove photos from album (multi-select UI)
- Comment thread on photo detail page (with nested replies, max 2 levels)
- Like button with optimistic UI update (toggle on/off)
- Follow/unfollow button on user profiles
- Following feed: photos from followed users, reverse chronological, cursor-paginated
- Like and comment counts displayed on photo cards in feeds/grids
- Text moderation: basic keyword filter on comment creation

#### Tests

- Unit: comment nesting logic, like toggle, follow constraints (can't follow self)
- Integration: create album → add photos → comment → like → verify counts
- E2E: follow a user → see their photos in feed

---

### Session 6 — Map & Location

**Goal:** Map-based photo browsing, geo-tagged photo display, and location management.

#### API (GraphQL)

```graphql
type Query {
  photosInBounds(
    north: Float!
    south: Float!
    east: Float!
    west: Float!
    first: Int
  ): [PhotoMapMarker!]!

  photosNearby(latitude: Float!, longitude: Float!, radiusKm: Float!, first: Int): PhotoConnection!

  airport(icaoCode: String, iataCode: String): Airport
  airports(
    search: String
    nearLatitude: Float
    nearLongitude: Float
    radiusKm: Float
    first: Int
    after: String
  ): AirportConnection!

  spottingLocation(id: ID!): SpottingLocation
  spottingLocations(airportId: ID, first: Int, after: String): SpottingLocationConnection!
}

type Mutation {
  setPhotoLocation(photoId: ID!, input: SetPhotoLocationInput!): PhotoLocation!
  removePhotoLocation(photoId: ID!): Boolean!
  createSpottingLocation(input: CreateSpottingLocationInput!): SpottingLocation!
}

type PhotoMapMarker {
  id: ID!
  thumbnailUrl: String!
  latitude: Float!
  longitude: Float!
}
```

#### Frontend pages

| Page         | Route              | Description                                     |
| ------------ | ------------------ | ----------------------------------------------- |
| Map explore  | `/map`             | Full-screen Mapbox map with photo markers       |
| Airport page | `/airports/[code]` | Airport info, nearby photos, spotting locations |

#### Key implementation details

- **Mapbox GL JS** via `react-map-gl`:
  - Full-screen map with photo markers (clustered via Supercluster)
  - Click cluster → zoom in; click marker → photo popup with thumbnail + link
  - Bounding box query: as user pans/zooms, fetch markers for visible area
  - Debounced fetch on map move (300ms)
- **Photo upload integration:**
  - If EXIF has GPS → auto-place marker on map in upload form
  - Manual pin: click map to set/override location
  - Privacy selector: exact / approximate (±500m random offset) / hidden
- **Airport pages:**
  - SSR page with airport info, map centered on airport, recent photos nearby
  - List of user-created spotting locations
  - Autocomplete airport search (ICAO/IATA/name)
- **PostGIS queries:**
  - `ST_MakeEnvelope` for bounding box queries
  - `ST_DWithin` for radius queries
  - Spatial index on `photo_locations.geom` and `airports.geom`

#### Tests

- Unit: privacy coordinate offsetting, bounding box validation
- Integration: create photo with location → query in bounds → verify returned
- E2E: open map → see markers → click through to photo

---

### Session 7 — Search, Reporting & Basic Admin

**Goal:** Basic search, content reporting, and a minimal admin console.

#### API (GraphQL)

```graphql
# Search
type Query {
  search(
    query: String!
    type: SearchType # USER, PHOTO, ALBUM, AIRPORT
    first: Int
    after: String
  ): SearchResultConnection!
}

# Reports
type Mutation {
  createReport(input: CreateReportInput!): Report!
}

# Admin
type Query {
  adminReports(status: ReportStatus, first: Int, after: String): ReportConnection!
  adminUsers(role: UserRole, status: UserStatus, first: Int, after: String): UserConnection!
  adminPhotos(moderationStatus: ModerationStatus, first: Int, after: String): PhotoConnection!
}

type Mutation {
  adminResolveReport(id: ID!, action: ReportAction!, note: String): Report!
  adminUpdateUserStatus(userId: ID!, status: UserStatus!): User!
  adminUpdatePhotoModeration(photoId: ID!, status: ModerationStatus!): Photo!
}
```

#### Search implementation (Phase 1a — PostgreSQL)

- Use PostgreSQL `tsvector` + `tsquery` for full-text search
- Build a `SearchService` interface with a Postgres implementation
- Search across: users (username, display_name, bio), photos (caption, tags, aircraft_type, airline), albums (title, description), airports (name, codes, city)
- Weighted ranking: exact match > prefix match > full-text match
- Airport autocomplete: trigram similarity (`pg_trgm`) for fuzzy matching
- **Later (Phase 2):** swap in OpenSearch implementation behind same interface

#### Frontend pages

| Page            | Route            | Description                                              |
| --------------- | ---------------- | -------------------------------------------------------- |
| Search          | `/search`        | Search bar with type filter tabs, paginated results      |
| Report modal    | (overlay)        | Report form accessible from any photo/comment/profile    |
| Admin dashboard | `/admin`         | Overview: pending reports, flagged photos, user stats    |
| Admin reports   | `/admin/reports` | Report queue with resolve/dismiss actions                |
| Admin users     | `/admin/users`   | User list with role/status management                    |
| Admin photos    | `/admin/photos`  | Moderation queue: flagged photos with Rekognition labels |

#### Key implementation details

- Search bar in global header (all pages)
- Search results with tabs: All, Users, Photos, Albums, Airports
- Report button on photos, comments, profiles, albums → modal with reason + description
- Admin route protection: `role === 'admin'` check in middleware
- Admin dashboard: counts (total users, photos, pending reports, flagged photos)
- Moderation queue: photos with `moderation_status = 'review'` shown with Rekognition labels and confidence
- Approve/reject buttons with one-click action
- User management: view user, change status (active/suspended/banned)

#### Tests

- Unit: search query building, report validation
- Integration: search returns expected results; create report → admin resolves
- E2E: search for a photo by aircraft type; report a photo; admin reviews and resolves

---

## Dependency Graph

```
Session 1: Monorepo + Docker + CI
    └── Session 2: Database + Auth
            └── Session 3: Profiles
                    └── Session 4: Photos + Upload
                            ├── Session 5: Albums + Comments + Likes + Follows
                            └── Session 6: Map + Location
                                    └── Session 7: Search + Reports + Admin
```

Sessions are sequential — each builds on the previous. The founder reviews and validates after each session before proceeding. Sessions 5 and 6 could theoretically run in parallel but sequential is simpler for review flow.

---

## Testing Strategy

| Layer             | Tool                     | Coverage target                                       |
| ----------------- | ------------------------ | ----------------------------------------------------- |
| Unit tests        | Vitest                   | All validation logic, business rules, utilities       |
| Integration tests | Vitest + Supertest       | All GraphQL resolvers with test database              |
| E2E tests         | Playwright               | Critical user flows (sign up, upload, browse, search) |
| Accessibility     | axe-core (in Playwright) | Run on every page during E2E                          |
| Linting           | ESLint + Prettier        | All code, enforced in CI                              |
| Type checking     | TypeScript strict        | All packages, enforced in CI                          |

**Test database:** Each integration test run creates a fresh schema (Prisma `migrate reset`), seeds test data, and tears down. Use a separate `test` Docker Compose profile.

---

## Definition of Done (per session)

Before the founder approves and moves to the next session:

- [ ] All tasks implemented and code committed
- [ ] Unit + integration tests passing
- [ ] E2E tests passing for new flows
- [ ] `turbo lint && turbo typecheck && turbo test` green
- [ ] CI pipeline green
- [ ] `docker compose up` starts cleanly and the new feature is manually testable
- [ ] No accessibility violations (axe-core)
- [ ] All UI strings externalized (message keys)
- [ ] Semantic HTML, keyboard navigable
- [ ] GraphQL schema documented (descriptions on types/fields)
- [ ] JSDoc on all public functions and service interfaces
- [ ] **Founder reviews:** runs the app locally, tests the new feature, and gives approval to proceed

---

## What's Next: Phase 1b Preview

After Phase 1a delivers a working alpha (auth, profiles, photos, albums, comments, likes, map, search, admin), Phase 1b adds:

1. **Communities** — CRUD, membership, roles, community pages, discovery
2. **Community-scoped forums** — categories, threads, posts within communities
3. **Community-scoped events** — creation, RSVP, reminders
4. **Community billing** — Stripe integration for community tiers
5. **Follows/feed enhancements** — community activity in feed
6. **Notification system** — in-app + email for likes, comments, follows, community activity
7. **Advanced moderation** — community-level mod tools, escalation

A separate implementation plan will be created for Phase 1b once Phase 1a is validated.
