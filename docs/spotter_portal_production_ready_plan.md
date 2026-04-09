# Production-Ready Project Plan — Spotter Community Portal

Global web-first community platform for plane spotters and aviation enthusiasts, with map-based discovery and optional live flight-data integration.

## Executive summary

Build a community-owned platform for plane spotters and aviation enthusiasts — not another photo archive. The core product is **user-created communities** (e.g., "LAX Spotters", "A380 Fans") with their own forums, shared albums, events, and member management. Individual users get profiles, geotagged photo uploads, map-based discovery, and social features for free. Revenue comes primarily from **community subscriptions** (paid by organizers, tiered by size), supplemented by individual premium upgrades and later ads. Marketplace features and live flight-data integration follow once the community base is established.

### Finalized technology decisions

| Area               | Choice                                   | Notes                                                    |
| ------------------ | ---------------------------------------- | -------------------------------------------------------- |
| Repo structure     | Turborepo monorepo                       | apps/web, apps/api, packages/shared, packages/db, infra/ |
| Frontend           | Next.js (App Router)                     | SSR for SEO; containerized on ECS Fargate                |
| API                | GraphQL (Apollo Server)                  | Containerized on ECS Fargate                             |
| Maps               | Mapbox GL JS (react-map-gl)              | Custom styling, WebGL rendering, clustering              |
| Billing            | Stripe (Billing + Customer Portal)       | Israeli account, tiered subscriptions                    |
| Auth               | Amazon Cognito                           | Email/password at launch                                 |
| Database           | PostgreSQL (RDS + PostGIS)               | Spatial queries for map features                         |
| Image processing   | AWS Lambda + Sharp                       | Event-driven, triggered by S3 uploads                    |
| Content moderation | AWS Rekognition (DetectModerationLabels) | Auto-screen uploads for unsafe content                   |
| Container runtime  | ECS Fargate                              | API + frontend; Lambda for event-driven workloads        |
| CDN                | CloudFront                               | Signed URLs for premium content                          |
| Caching            | ElastiCache (Redis)                      | Sessions, rate limiting, feeds, map queries              |
| Search             | Amazon OpenSearch                        | Full-text + faceted search                               |
| Email              | Amazon SES                               | Transactional + digest                                   |
| CI/CD              | GitHub Actions                           | Automated build, test, deploy                            |
| IaC                | AWS CDK (TypeScript)                     | Shared types with monorepo                               |

---

## 1. Product strategy

The product should be positioned as **the platform where spotting communities live**. Photos and maps are important tools, but the real product is the ability for groups of enthusiasts to organize, share, discover, and connect — with communities as the central organizing unit.

- Primary audience at launch: global plane spotters, aviation photographers, aircraft enthusiasts, airport visitors, and **local spotting groups and clubs**.
- Future audience expansion: train spotters and other transport enthusiast communities.
- Core product: user-created communities with scoped forums, shared albums, events, and member management.
- Media scope at launch: photo only.
- Monetization at launch: community subscriptions (paid by organizers), supplemented by individual premium upgrades.
- Marketplace at launch: deferred — listings and user connection only, no platform-managed payment flow.
- Location strategy: geotagged photos, location pages, map browsing, and community association with locations are core product features.
- Flight data strategy: integrate in phases, with clear cost and licensing controls.

## 2. Product vision and success criteria

### Vision statement

The home platform where spotting communities live — with user-created groups, geotagged albums, discussions, events, map-based discovery, and later exchange.

### Business goals

- Establish the default platform for spotting communities worldwide.
- Generate early recurring revenue through community subscriptions (paid by organizers).
- Create practical utility through location-based discovery and community tools.
- Build a strong enough community base to support later marketplace monetization.
- Supplement revenue with individual premium upgrades and advertising at scale.
- Preserve optionality for additional enthusiast categories later.

### Success criteria for year 1

| Metric                                          | Target                        | Rationale                                           |
| ----------------------------------------------- | ----------------------------- | --------------------------------------------------- |
| Registered users                                | 5,000+                        | Critical mass for community network effects         |
| Monthly active users (MAU)                      | 1,000+                        | Shows sustained engagement beyond sign-up           |
| 7-day retention                                 | ≥ 25%                         | Indicates product stickiness for new users          |
| 30-day retention                                | ≥ 15%                         | Confirms long-term habit formation                  |
| Photos uploaded per month                       | 10,000+                       | Validates core upload loop                          |
| Comments per active user per month              | ≥ 3                           | Shows community interaction, not just consumption   |
| Forum threads created per month                 | 100+                          | Validates discussion feature demand                 |
| Communities created                             | 50+                           | Shows organizers see value in the platform          |
| Paid community conversions                      | ≥ 10% of communities          | Demonstrates willingness to pay for community tools |
| Individual premium conversion rate              | ≥ 3% of MAU                   | Secondary revenue from power users                  |
| Monthly recurring revenue (MRR)                 | Covering infrastructure costs | Baseline financial sustainability                   |
| Moderation queue resolution time                | < 24 hours (p90)              | Operationally manageable with part-time moderation  |
| Upload failure rate                             | < 1%                          | Production reliability baseline                     |
| Marketplace listing interest (surveys/waitlist) | 200+ expressions of interest  | Validates Phase 4 demand before building            |

## 3. Scope definition

### 3.1 In scope for production release

- User registration, login, password reset, and account settings
- Public profiles with experience, gear, interests, favorite aircraft, favorite airports, region, and bio
- Follow/unfollow users with follower counts and following feed
- **User-created communities** with member management, roles (owner, admin, moderator, member), join/invite flows, and community profiles
- **Community-scoped features:** forums, shared albums, events, and announcements within each community
- Community subscription tiers (free, standard, large, enterprise) with Stripe billing
- Photo uploads with EXIF extraction, compression, derivatives, and album organization
- Photo coordinates and map-based browsing
- Comments, likes, favorites, and reporting
- Platform-wide forum categories, threads, replies, and moderation
- Event creation, RSVP, reminders, and event pages (both platform-wide and community-scoped)
- Search by user, community, airport, aircraft type, tags, topic, and location
- Admin and moderation console (platform-level and community-level)
- Individual premium subscriptions (ad-free, analytics, portfolio)
- In-app notifications, transactional email, and digest email
- CI/CD pipeline with automated testing and staged deployments
- SEO foundations (SSR, structured data, sitemaps, Open Graph)
- Accessibility compliance (WCAG 2.1 Level AA)
- Internationalization readiness (string externalization, locale-aware formatting)
- Basic analytics and KPI instrumentation

### 3.2 Deferred but planned

- Private messaging
- Native mobile app
- Video uploads
- In-platform checkout and payments
- Advanced trust scoring for sellers
- Wider expansion beyond aviation

## 4. Core product modules

### Identity and profiles

- Email/password signup at first; social login can be added later.
- Public profile, private settings, optional profile badges, and plan status.
- Profile sections for spotting experience, interests, gear, and location region.
- Follow/unfollow other users; follower and following counts on profile.
- Following feed showing recent uploads, comments, and activity from followed users.

### Communities

Communities are the core organizational unit of the platform. Any user can create a community around a shared interest — an airport, an aircraft type, a regional spotting group, a photography style, or any aviation topic.

- **Creation and profile:** name, description, banner image, avatar, location/region, category tags, and visibility (public or invite-only).
- **Membership:** join requests (open or approval-required), invite links, member directory, and member count.
- **Roles:** owner, admin, moderator, member. Owners manage billing and community settings; admins manage members and content; moderators handle day-to-day content moderation.
- **Community-scoped features:** each community gets its own forums, shared albums, events calendar, and announcements feed — separate from the platform-wide equivalents.
- **Community page:** public landing page showing description, recent photos, upcoming events, active discussions, and member count. Indexable for SEO.
- **Discovery:** communities appear in search results, on location pages (e.g., communities near an airport), and in a browsable directory.
- **Moderation:** community-level moderation tools for admins/mods; platform-level override for abuse cases.
- **Analytics (paid tiers):** member growth, engagement metrics, popular content, active times.

### Photos and albums

- Upload original image, generate resized variants, store metadata, create albums.
- Support caption, tags, aircraft type, airline, airport, date, and coordinates.
- Allow comments and likes at photo and album level.
- Photos and albums can belong to an individual user, a community, or both (cross-posted).

### Map and location system

- Display photos by map location.
- Support exact coordinates, approximate area, or hidden location based on privacy setting.
- Create airport pages and manually named spotting locations.
- Communities can be associated with locations and appear on the map.

### Forums

- Platform-wide discussion categories such as spotting advice, airports, airlines, photography gear, trip reports, and safety topics.
- Community-scoped forums managed by community admins — categories, pinned threads, and member-only discussions.
- Moderation controls, pinned threads, and reporting at both levels.

### Events

- Users, communities, or platform admins can create meetups, airport sessions, airshow plans, or spotting days.
- Event page includes location, time, organizer, attendee list, reminders, and hosting community (if applicable).
- Community events appear on the community page and in members' feeds.

### Marketplace later

- Listing creation, images, categories, description, contact request, and report abuse.
- No checkout in phase 1 of marketplace.

### Flight data integration later

- Location-based live flights, airport live boards, and flight-to-photo linkage in later phases.

## 5. Geotagged photo and map feature design

This feature should be treated as a differentiator, not a side enhancement.

| Capability      | User value                        | Data needed                          | Release recommendation |
| --------------- | --------------------------------- | ------------------------------------ | ---------------------- |
| EXIF GPS import | Fast upload workflow              | Latitude, longitude, camera metadata | MVP                    |
| Manual map pin  | Useful when EXIF is missing       | Selected point, zoom level           | MVP                    |
| Privacy mode    | Protect sensitive spotting points | Exact / approximate / hidden         | MVP                    |
| Location pages  | Discover best places to spot      | Airport, viewpoint, city, country    | MVP+1                  |
| Map browse      | Explore photos visually           | Coordinates and indexing             | MVP                    |
| Nearby photos   | Local community utility           | Geo queries                          | MVP+1                  |

Additional design rules:

- Store both raw coordinates and a privacy-filtered display coordinate.
- Allow coordinate override when EXIF is wrong.
- Index location data for fast bounding-box and radius searches.
- Support country, city, airport, and named spot location as separate fields where possible.

## 6. Flight-data integration strategy

Do not let flight tracking dominate the first production release. It should support the community, not become a separate full-scale tracking business.

### Recommended phased approach

- Phase A: no live data in MVP, only a data model placeholder for future linkage.
- Phase B: add airport-based or location-based live flight widgets.
- Phase C: add richer live map overlays and photo-to-flight matching.
- Phase D: evaluate historical flight lookups, advanced aviation metadata, and premium flight tools.

### Production decision points

- Select official flight-data provider and confirm licensing terms.
- Model API cost exposure per daily active user and per map session.
- Cache aggressively within provider rules to control cost.
- Restrict live data to selected pages and premium features if needed.

## 7. Tiers and packaging

### Individual user tiers

The individual free tier is deliberately generous — the goal is to grow the user base, not gate basic participation. Revenue comes from communities, not upload limits.

| Tier    | Target user | Uploads/month | Max resolution    | Max file size | Storage cap | Key features                                                                          | Business role               |
| ------- | ----------- | ------------- | ----------------- | ------------- | ----------- | ------------------------------------------------------------------------------------- | --------------------------- |
| Free    | All users   | 50            | 2048px            | 20 MB         | 5 GB        | Profile, albums, map, comments, forums, events, join communities                      | Acquisition and growth      |
| Premium | Power users | 200           | 4096px (full-res) | 50 MB         | 25 GB       | Ad-free, portfolio mode, photo analytics, priority search placement, enhanced profile | Secondary recurring revenue |

### Community tiers (primary revenue)

Paid by the community owner/organizer. Billing via Stripe, managed through the community settings page.

| Tier              | Max members | Forums       | Albums           | Events           | Admins/mods | Extra features                                                                      | Price guidance     |
| ----------------- | ----------- | ------------ | ---------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------- | ------------------ |
| Free              | 25          | 1 category   | 3 shared albums  | 2 active events  | 1 owner     | Basic community page                                                                | Free               |
| Standard          | 200         | 5 categories | 20 shared albums | 10 active events | 3           | Custom banner, invite links, pinned posts                                           | Low monthly fee    |
| Large             | 1,000       | Unlimited    | Unlimited        | Unlimited        | 10          | Analytics dashboard, featured placement, announcement emails to members             | Medium monthly fee |
| Club / Enterprise | Unlimited   | Unlimited    | Unlimited        | Unlimited        | 25          | Custom branding, verified badge, API access, priority support, dedicated onboarding | Higher monthly fee |

### Image handling rules

- **Originals are always stored at full resolution** regardless of tier — if a user upgrades, existing photos immediately benefit without re-upload.
- **Derivatives are generated per tier** — free individual users receive up to 2048px variant via CloudFront; premium users get full-res (4096px).
- **Tier upgrade triggers a re-processing job** — Lambda generates higher-resolution derivatives for existing photos.
- **Tier downgrade** — new uploads use lower limits; existing photo derivatives are retained with a 30-day grace period.
- **Accepted formats:** JPEG, PNG, WebP. HEIC auto-converted to JPEG on upload. RAW support deferred.

## 8. Monetization plan

### Revenue streams (in priority order)

1. **Community subscriptions** (primary) — organizers pay monthly for community tools, member capacity, and features. This is the core business model.
2. **Individual premium subscriptions** (secondary) — power users pay for ad-free experience, portfolio mode, analytics, and higher upload limits.
3. **Featured placements** — promoted communities, albums, creators, and events in discovery feeds and search results.
4. **Affiliate partnerships** — aviation and photography product recommendations.
5. **Advertising** (later) — display ads on free-tier pages only, introduced after meaningful traffic exists (50K+ MAU).
6. **Marketplace fees** (later) — listing fees or transaction fees after marketplace launch.

### Monetization principles

- Keep the individual free tier generous — the user base is the product's value; do not gate basic participation.
- Monetize the **organizer**, not the participant — community owners get value from tools, capacity, and visibility.
- Advertising appears only on free-tier individual pages, never inside community spaces (this protects the premium feel of paid communities).
- Do not build a complex checkout system before marketplace demand is validated.

### Monetization by phase

| Stage                           | Main revenue                                 | Operational complexity | Recommendation                          |
| ------------------------------- | -------------------------------------------- | ---------------------- | --------------------------------------- |
| Pre-launch / MVP                | None — invite-only                           | Low                    | Focus on community health and seeding   |
| Phase 1b launch                 | Community subscriptions + individual premium | Low                    | Core business model live                |
| Early growth                    | + Featured placements + affiliates           | Low/Medium             | Expand revenue without ads              |
| Established platform (50K+ MAU) | + Advertising on free tier                   | Medium                 | Supplement, not replace, subscriptions  |
| Mature platform                 | + Marketplace fees + sponsorships            | Medium/High            | Expand only after trust and scale exist |

## 9. Production architecture

### Recommended stack

- **Repo structure:** Turborepo monorepo (apps/web, apps/api, packages/shared, packages/db, infra/)
- **Frontend:** Next.js (App Router, server components for SEO-critical pages) — containerized on ECS Fargate
- **API layer:** GraphQL (Apollo Server) — containerized on ECS Fargate; provides strong typing and flexible client-side data fetching for feeds, profiles, albums, and map views
- **Authentication:** Amazon Cognito
- **Maps:** Mapbox GL JS via react-map-gl — custom-styled map for photo browsing, clustering, and location discovery
- **Billing:** Stripe (Billing, Customer Portal, Webhooks) — tiered subscription management with Israeli account support
- **Image storage:** Amazon S3 (separate buckets for originals and derivatives)
- **Image processing:** AWS Lambda with Sharp (libvips) — triggered by S3 upload events for thumbnail generation, resizing, watermarking, and EXIF extraction
- **Content moderation:** AWS Rekognition `DetectModerationLabels` — called in the same Lambda pipeline to screen every upload for unsafe content
- **Image formats:** JPEG, PNG, WebP accepted at upload; HEIC auto-converted to JPEG; RAW deferred
- **CDN:** Amazon CloudFront (with signed URLs for premium-resolution images)
- **Caching:** Amazon ElastiCache for Redis — session store, rate-limiting counters, feed/timeline caching, map tile query caching, and hot-path data (trending photos, leaderboard, popular locations)
- **Relational data:** Amazon RDS for PostgreSQL (with PostGIS extension for spatial queries)
- **Search:** Amazon OpenSearch
- **Email:** Amazon SES for transactional email (verification, password reset, event reminders, digest notifications)
- **Push notifications:** Amazon SNS for mobile push; web push via service workers
- **Background jobs and reminders:** AWS Lambda + SQS queues, EventBridge Scheduler
- **Container orchestration:** Amazon ECS Fargate — GraphQL API and Next.js frontend run as independent Fargate services with auto-scaling; Lambda reserved for event-driven workloads (image processing, background jobs)
- **CI/CD:** GitHub Actions for automated build, test, and deployment
- **Infrastructure as code:** AWS CDK (TypeScript, shares types with the monorepo)
- **Monitoring:** CloudWatch plus application-level metrics and alerting

### Architecture principles

- Keep the core data model relational and explicit.
- Separate original images from derived display images.
- Keep moderation and analytics pipelines asynchronous.
- Abstract flight-data provider behind an internal service to avoid hard provider lock-in.
- Treat map and search indexing as first-class infrastructure, not afterthoughts.

### Image upload and screening pipeline

Every photo upload flows through a single Lambda function triggered by S3 `PutObject` events:

```
User uploads photo → S3 (originals bucket)
  └─► Lambda trigger:
      1. Validate format and file size against user tier limits
      2. EXIF extraction (GPS coordinates, camera metadata, date)
      3. HEIC → JPEG conversion (if needed)
      4. Sharp: generate tier-appropriate derivatives (thumbnail, display, full-res)
      5. Store derivatives in S3 (derivatives bucket)
      6. Rekognition: DetectModerationLabels on original
         ├─ Confidence ≥ 90%  → auto-reject; delete derivatives; notify user
         ├─ Confidence 60–90% → hold for manual review (moderation queue); derivatives not published
         └─ Confidence < 60%  → auto-approve; publish to CDN
      7. Write photo record + moderation result to database
      8. Invalidate CloudFront cache if needed
      9. Send notification to followers (if auto-approved)
```

**Design decisions:**

- **Rekognition categories screened:** Explicit Nudity, Suggestive, Violence, Visually Disturbing, Drugs, Gambling, Hate Symbols.
- **Aviation edge cases:** aircraft nose art, military liveries, and vintage pin-up artwork on aircraft may trigger false positives in the 60–90% range — the manual review queue handles these without over-blocking.
- **Cost:** ~$1 per 1,000 images. At 5K uploads/month = ~$5/month.
- **Latency:** Rekognition adds ~500ms to the pipeline; total upload-to-available target remains < 30 seconds.
- **Moderation record:** every photo stores its `moderation_status` (approved, rejected, pending_review), `moderation_labels` (from Rekognition), and `moderation_confidence` for audit purposes.
- **Manual review:** photos in the 60–90% confidence range appear in the admin moderation queue with the Rekognition labels and confidence scores displayed, allowing fast approve/reject decisions.

### Performance and capacity targets

| Metric                                  | Target                    | Notes                                                          |
| --------------------------------------- | ------------------------- | -------------------------------------------------------------- |
| API response time (p95)                 | < 200 ms                  | Excluding image upload; measured at CDN edge                   |
| Map tile / bounding-box query (p95)     | < 300 ms                  | PostGIS spatial index; Redis cache for hot regions             |
| Search query latency (p95)              | < 500 ms                  | OpenSearch with warm indexes                                   |
| Image upload to derivative availability | < 30 seconds              | Lambda pipeline: upload → resize → CDN invalidation            |
| Page load (Largest Contentful Paint)    | < 2.5 seconds             | Next.js SSR + CloudFront; target Core Web Vitals "Good"        |
| Uptime SLA                              | 99.9%                     | Measured monthly; excludes planned maintenance windows         |
| Concurrent users at launch              | 500                       | Scale target for Phase 3; auto-scaling configured for 5× burst |
| Daily photo uploads at launch           | 1,000–5,000               | Informs S3 lifecycle and Lambda concurrency settings           |
| Database connections                    | Pool max 100 per instance | RDS proxy recommended if connection pressure grows             |

## 10. Suggested domain model

Initial core entities:

1. users
2. profiles
3. user_subscriptions (individual premium plans via Stripe)
4. follows (follower/following relationships between users)
5. **communities** (name, description, banner, avatar, category, visibility, location, owner FK)
6. **community_members** (user FK, community FK, role: owner/admin/moderator/member, joined_at, status)
7. **community_subscriptions** (community FK, Stripe subscription ID, tier, limits, billing status)
8. albums (can belong to user, community, or both)
9. photos
10. photo_variants (thumbnails, display, full-res, watermarked)
11. photo_tags
12. photo_locations (per-photo coordinates — raw and privacy-filtered; FK to optional spotting_location or airport)
13. airports (canonical airport records — ICAO/IATA codes, coordinates, metadata)
14. spotting_locations (named viewpoints or areas near airports; FK to optional airport)
15. comments
16. likes
17. forum_categories (can be platform-wide or community-scoped)
18. forum_threads
19. forum_posts
20. events (can be platform-wide or community-scoped)
21. event_attendees
22. reports
23. moderation_actions
24. notifications
25. marketplace_listings (later)
26. listing_images (later)
27. flight_matches (later)

### Entity relationship notes — geo model

The three geo-related entities serve distinct purposes and relate as follows:

- **airports** — canonical reference data. Each record represents a real airport with ICAO/IATA codes and coordinates. Sourced from aviation reference datasets and admin-managed.
- **spotting_locations** — user- or admin-created named viewpoints (e.g., "Myrtle Avenue threshold 27L"). Each spotting_location optionally references a parent airport. Has its own coordinates, description, access notes, and rating.
- **photo_locations** — per-photo record storing raw GPS coordinates (from EXIF or manual pin) and a privacy-filtered display coordinate. Optionally links to a spotting_location and/or airport for structured discovery. This is the entity indexed with PostGIS for spatial queries.

This separation allows photos to exist with free-form coordinates even when no named location or airport exists, while still enabling structured browsing by airport → spotting location → photos.

## 11. API and feature contracts

### Must-have service contracts

- Auth service
- Profile service
- Follow service (follow/unfollow, follower lists, following feed)
- Community service (create, manage, join/leave, invite, member roles, community settings, community discovery)
- Community billing service (Stripe integration for community tier subscriptions, upgrades, downgrades)
- Media upload service
- Photo metadata service
- Location service
- Forum service (platform-wide and community-scoped)
- Event service (platform-wide and community-scoped)
- Search service (users, communities, photos, locations, forums)
- Moderation service (platform-level and community-level)
- Notification service (in-app, email digest, push)
- Subscription/billing service (individual premium)

### API design rules

- Version public APIs or schema changes carefully.
- Use signed upload flow for direct-to-storage media uploads.
- Protect write operations with authorization checks and rate limits.
- Support cursor-based pagination for feeds, forums, and comments.
- Log audit-relevant changes for moderation and billing events.

## 12. Security, privacy, and trust

- Role-based access: user, moderator, admin, premium, seller later
- Privacy controls for location precision
- Secure signed upload URLs for image upload
- Moderation queue for reported content
- Rate limiting for uploads, comments, and login abuse
- Clear acceptable-use policy and marketplace prohibited-items policy
- Audit logging for admin and moderator actions
- Data retention and deletion flows for user account closure

## 13. SEO strategy

A content-heavy, photo-driven community platform must treat SEO as a first-class concern from day one.

### Technical SEO

- Use Next.js server-side rendering (SSR) and static generation (SSG) for all public-facing pages: profiles, photo pages, album pages, location pages, airport pages, forum threads, and event pages.
- Generate dynamic `sitemap.xml` from database (photos, profiles, locations, forum threads) with appropriate change frequencies.
- Implement structured data (JSON-LD) for photos (ImageObject), locations (Place), events (Event), and profiles (Person).
- Canonical URLs for all content; prevent duplicate indexing of paginated feeds.
- Optimize Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1.
- Use `next/image` with CloudFront for responsive image delivery with proper `srcset`, `sizes`, and lazy loading.
- Implement `robots.txt` and `meta robots` to control crawler access (e.g., exclude admin, settings, and private content).

### Content SEO

- Auto-generate meaningful page titles and meta descriptions from photo metadata, location names, and tags (e.g., "Boeing 747 at London Heathrow — SpotterHub").
- Create rich, indexable location pages (airport pages, spotting location pages) that aggregate photos, discussions, and events.
- Forum threads should be indexable — they provide long-tail keyword coverage for aviation and spotting topics.
- User profiles should be optionally indexable (user preference) with Open Graph tags for social sharing.

### Social sharing

- Open Graph and Twitter Card meta tags on all public content pages.
- Auto-generated share images for photos (with branding overlay) and events.

## 14. Accessibility

The platform must be usable by people with disabilities and comply with WCAG 2.1 Level AA as a baseline.

### Design and development standards

- All interactive elements must be keyboard-navigable with visible focus indicators.
- Color contrast ratios must meet WCAG 2.1 AA minimums (4.5:1 for body text, 3:1 for large text and UI components).
- All images must have meaningful `alt` text — auto-generate from photo metadata (aircraft type, airline, airport) with user override.
- Form inputs must have associated labels; error messages must be programmatically linked to fields.
- Use semantic HTML throughout (landmarks, headings hierarchy, lists, tables).
- Map components must provide a non-visual alternative (list view of nearby photos, text-based location search).
- Modals, dropdowns, and tooltips must trap focus correctly and be dismissible via keyboard.

### Testing and compliance

- Include accessibility checks in CI (e.g., axe-core, Lighthouse CI).
- Conduct manual screen reader testing (VoiceOver, NVDA) before each major release.
- Maintain an accessibility statement page describing conformance level and known limitations.
- Provide a contact channel for accessibility feedback and issues.

## 15. Internationalization (i18n)

Although launching in English, the platform must be architected for future localization from day one.

### Technical foundations

- Use a library like `next-intl` or `react-i18next` for string externalization from the start.
- All user-facing strings must use message keys, not hardcoded text — enforce via lint rules.
- Support locale-aware formatting for dates, times, numbers, and distances (e.g., miles vs. kilometers).
- Store user locale preference in profile settings.
- URL structure should support locale prefixes (e.g., `/en/`, `/de/`) when localization is activated.

### Launch approach

- Phase 1: English only, but all strings externalized.
- Phase 2: Add community-contributed translations for high-demand languages (start with languages where spotting communities are active — e.g., German, Japanese, Portuguese, Spanish).
- Phase 3: Professional translation for core UI and legal/policy content.

### Content considerations

- User-generated content (comments, forum posts, captions) remains in its original language — do not auto-translate.
- Navigation, UI chrome, error messages, and system notifications are translatable.
- Metadata fields (aircraft type, airline, airport) use standardized codes (ICAO/IATA) that are language-neutral.

## 16. Notification and email strategy

### Notification channels

| Channel             | Use cases                                                                                 | Technology                                          |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| In-app              | New followers, likes, comments, event reminders, moderation actions                       | WebSocket or polling; stored in notifications table |
| Email               | Account verification, password reset, weekly digest, event reminders, moderation outcomes | Amazon SES                                          |
| Web push            | New comments on followed photos, event starting soon, new photos at followed locations    | Service workers + Web Push API                      |
| Mobile push (later) | Same as web push, for native app                                                          | Amazon SNS                                          |

### Email types

- **Transactional:** verification, password reset, subscription confirmation — send immediately, no opt-out.
- **Triggered:** new follower, comment on your photo, event reminder — send near-real-time, individually opt-out-able.
- **Digest:** weekly summary of activity in followed locations, new photos from followed users — batched, opt-in.
- **Marketing (later):** platform announcements, feature launches — CAN-SPAM/GDPR compliant, opt-in only.

### Notification preferences

- Users can configure notification preferences per channel and per event type.
- Default to sensible on/off settings that avoid notification fatigue.
- Respect quiet hours if user sets a timezone preference.

### Deliverability

- Configure SES with custom domain (DKIM, SPF, DMARC).
- Maintain dedicated IP reputation or use SES shared pool with monitoring.
- Implement bounce and complaint handling with automatic suppression list.
- Target < 5% bounce rate and < 0.1% complaint rate.

## 17. Operational readiness

### CI/CD pipeline

- Source control: Git (GitHub) with branch protection on main
- Automated pipeline: GitHub Actions (or AWS CodePipeline)
  - On pull request: lint, type-check, unit tests, integration tests, build
  - On merge to main: deploy to staging automatically
  - Production deploy: manual approval gate after staging verification
- Infrastructure as code: AWS CDK or Terraform for all cloud resources
- Database migrations: versioned and automated (e.g., Prisma Migrate, Flyway)
- Feature flags: LaunchDarkly or AWS AppConfig for controlled rollouts
- Environment parity: development, staging, and production environments with identical configurations

### Monitoring and alerting

- Availability monitoring for frontend, API, auth, DB, search, and background jobs
- Error-rate dashboards
- Upload pipeline alerts
- Search latency alerts
- Notification failure alerts (SES bounce rate, SNS delivery failures)
- Email delivery monitoring (SES reputation dashboard, bounce/complaint rates — maintain < 5% bounce, < 0.1% complaint)
- Subscription and billing anomaly alerts
- Lambda function error rate and duration alerts (image processing pipeline)
- Redis cache hit-rate monitoring (alert if hit rate drops below 80%)

### Runbooks

- Image upload failure runbook
- High error-rate runbook
- Database performance runbook
- Search indexing lag runbook
- Moderation backlog runbook
- Third-party API outage runbook for flight-data provider
- SES sending limit or reputation runbook
- Redis failover runbook

### Backups and recovery

- Point-in-time restore for primary database
- Versioning and lifecycle policies for media storage where appropriate
- Redis snapshot backups for session and cache data
- Recovery test schedule (quarterly disaster recovery drills)
- Environment separation for development, staging, and production

## 18. Moderation and community operations

### Automated content screening

- **Image moderation:** AWS Rekognition `DetectModerationLabels` runs on every upload in the Lambda pipeline (see Section 9: Image upload and screening pipeline). Three-tier outcome: auto-reject (≥ 90% confidence), manual review (60–90%), auto-approve (< 60%).
- **Text moderation:** keyword and rule-based screening for comments, forum posts, community names, and profile bios. Flag or block known slurs, spam patterns, and prohibited content.
- **Repeat offender detection:** track per-user rejection and report counts. Auto-flag accounts exceeding thresholds for review.

### Manual moderation

- User reports for photos, comments, profiles, events, communities, and listings.
- Moderator review queues with priority scoring (Rekognition-flagged content prioritized, then user reports by volume).
- Community-level moderators handle their own community content; platform admins have override authority for abuse, legal, and policy violations.
- Escalation path: warning → 7-day content restriction → 30-day suspension → permanent ban.

### Policies and compliance

- Community guidelines written in plain language, covering: prohibited content, harassment, spam, intellectual property, and marketplace rules.
- Soft enforcement first when possible, hard enforcement for abuse and fraud.
- GDPR-compliant data handling for EU users (right to erasure, data export, consent management).
- Transparency: users can view the status and reason for any moderation action on their content.

## 19. Marketplace readiness plan

Marketplace should be enabled only when the community is active enough to justify it.

- Phase 1: no marketplace
- Phase 2: simple listings, images, categories, and contact requests
- Phase 3: featured listings and seller badges
- Phase 4: optional payment integration only after trust, fraud, and legal requirements are understood

## 20. Delivery roadmap

### Scope realism note

The full scope is ambitious for a solo developer. The recommended approach is to split into focused sub-phases, with each phase delivering a usable, testable product increment:

- **Phase 1a (6–8 weeks):** Auth, profiles, photo uploads, albums, comments, likes, map tagging, basic search, basic admin. This is the minimum viable product — users can sign up, upload photos, and browse.
- **Phase 1b (6–8 weeks):** Communities (the core product differentiator), community-scoped forums, events, follows/feed, community billing (Stripe), advanced search, moderation tools, notification system. This is where the monetization model goes live.

Phase 1a validates the core upload-and-browse loop; Phase 1b validates the community model and revenue hypothesis.

### Roadmap

| Phase                  | Duration   | Key deliverables                                                                                                                                       | Exit criteria                                                          |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Phase 0: Definition    | 2–4 weeks  | Final product spec, wireframes, data model, GraphQL schema, architecture, CI/CD pipeline, backlog                                                      | Scope signed off; staging environment provisioned; monorepo scaffolded |
| Phase 1a: Core build   | 6–8 weeks  | Auth, profiles, uploads, albums, comments, likes, map tagging, basic search, basic admin console                                                       | Private alpha ready; core upload-and-browse loop functional            |
| Phase 1b: Communities  | 6–8 weeks  | Community CRUD, membership, roles, community forums, community events, follows/feed, community billing (Stripe), moderation tools, notification system | Private beta ready; communities functional; revenue model live         |
| Phase 2: Launch prep   | 4–6 weeks  | Individual premium subscriptions, analytics, SEO implementation, a11y audit, runbooks, alerts, hardening, performance tuning, load testing             | Production readiness review passed                                     |
| Phase 3: Public launch | 2–4 weeks  | Controlled rollout, onboarding flows, bug fixes, support process, community seeding with real spotting groups                                          | Stable live metrics meeting Year 1 targets trajectory                  |
| Phase 4: Expansion     | 6–10 weeks | Marketplace listings, location pages, richer discovery, i18n Phase 2, advertising integration, optional live data widgets                              | Demand validated                                                       |

## 21. Team and delivery assumptions

### Current team

- Solo founder/developer (full-stack) with AI-assisted development
- Part-time designer (contract, as needed for wireframes and visual design)
- Founder-led moderation at launch

### Future hiring triggers

- **First hire (backend or full-stack):** when community count exceeds 20 paid communities or operational load exceeds solo capacity.
- **Moderation help:** when report volume exceeds 1-hour/day founder time.
- **Designer:** when preparing for public launch (Phase 3).

### Suggested working model

- Two-week sprints with clear deliverables
- Production-like staging environment from day one
- Weekly self-review of progress against roadmap
- Release checklist for each deployment
- Automated testing as a substitute for dedicated QA

## 22. KPI framework

| Category    | Core KPIs                                                                                 | Why it matters                        |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------- |
| Growth      | Registrations, profile completion, first upload conversion                                | Shows onboarding effectiveness        |
| Communities | Communities created, paid conversion rate, avg members per community, community retention | Shows core product and revenue health |
| Engagement  | Comments per active user, forum replies, map views, event RSVPs, follow rate              | Shows community quality               |
| Retention   | 7-day and 30-day retention (users), community monthly active rate                         | Shows product stickiness              |
| Revenue     | Community subscription MRR, individual premium MRR, total MRR, ARPU                       | Shows business viability              |
| Operations  | Report resolution time, search latency, upload failure rate, p95 API latency              | Shows production health               |
| SEO         | Organic search impressions, click-through rate, indexed pages                             | Shows discoverability growth          |

## 23. Key risks and mitigation

| Risk                                                | Impact      | Mitigation                                                                                                                                                     |
| --------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Competing as a giant archive instead of a community | High        | Position around community, map utility, and identity rather than archive scale                                                                                 |
| Storage and CDN cost growth                         | High        | Tiered limits, derivative images, lifecycle rules, and premium packaging                                                                                       |
| Weak community activity                             | High        | Seed with real spotting groups and structured onboarding                                                                                                       |
| Location privacy concerns                           | Medium/High | Support exact, approximate, and hidden location modes                                                                                                          |
| Flight-data cost or licensing shock                 | Medium/High | Keep behind feature flags and phased rollout                                                                                                                   |
| Marketplace fraud later                             | Medium/High | Start with listings only and strong reporting/moderation                                                                                                       |
| Phase 1 scope overrun                               | High        | Split into Phase 1a/1b; prioritize core upload loop, then communities                                                                                          |
| Communities fail to monetize                        | High        | Validate with real spotting groups before building paid tiers; keep free tier useful enough to attract organizers; iterate on tier packaging based on feedback |
| Community moderation burden                         | Medium/High | Community-level mods handle their own spaces; platform override only for abuse; automated content screening reduces manual work                                |
| Empty community problem                             | Medium      | Seed with 5–10 real spotting groups at launch; provide onboarding templates for community setup; highlight active communities in discovery                     |
| SEO cold start                                      | Medium      | Pre-seed location pages with airport data; SSR from day one; submit sitemaps early                                                                             |
| Email deliverability                                | Medium      | Configure DKIM/SPF/DMARC before launch; monitor SES reputation from first send                                                                                 |
| Accessibility litigation                            | Medium      | WCAG 2.1 AA compliance from launch; accessibility statement; feedback channel                                                                                  |
| Single-region outage                                | Medium      | Deploy to single region initially but design for multi-region; use CloudFront global edge                                                                      |

## 24. Recommended immediate next actions

1. **Scaffold the monorepo** — Turborepo, Next.js, Apollo Server, shared types, Docker Compose for local dev.
2. **Set up CI/CD** — GitHub Actions pipeline with lint, type-check, test, build.
3. **Design the PostgreSQL schema** — users, profiles, communities, community_members, photos, albums, photo_locations, airports, comments, likes, follows, forums, events, notifications, subscriptions. Include PostGIS.
4. **Write the GraphQL schema** — start with auth, profiles, and photo CRUD mutations/queries.
5. **Set up Stripe** — create products and prices for community tiers; implement webhook handler.
6. **Design wireframes** — community page, profile, photo page, map view, community directory, forum, event page, admin console.
7. **Provision AWS staging** — CDK stack for RDS, S3, CloudFront, Cognito, ElastiCache, Lambda.
8. **Seed reference data** — airports table with ICAO/IATA codes and coordinates.
9. **Configure SES** — domain authentication (DKIM, SPF, DMARC) for transactional email.
10. **Identify 5–10 real spotting groups** — reach out for beta testing and community seeding.
11. **Externalize all UI strings** from day one (i18n readiness).
12. **Build the implementation backlog** — break Phase 1a into sprint-sized tickets.
