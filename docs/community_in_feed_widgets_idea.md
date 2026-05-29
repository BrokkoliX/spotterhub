# Interleaved community widget on the home feed

## Status

Design locked, API shipped, web pending. This document captures the full design for an in-feed community surface on the home page, replacing an earlier sidebar pilot that broke the existing photo-grid aesthetic and tested poorly. It also records the rationale for each non-obvious decision, so future maintainers do not re-litigate settled questions.

The API additions described under "What is already built" have landed. The Prisma migration, `dismissFeedWidget` mutation, `User.dismissedFeedWidgets` field, `Query.recentForumThreads`, `Query.communities(sort:)`, `Query.photos(communityIds:)`, `Photo.community`, and `ForumCategory.community` are all on `main`. Web implementation has not started.

## Hypothesis

The earlier pilot introduced communities as a permanent right rail, which competed visually with the photo feed and made the home page feel cluttered on every scroll. The interleaved approach instead places one community-context block at a single anchor point inside the photo flow, so the feed remains the unambiguous primary surface and the community surfacing is a momentary aside the user scrolls past once per visit.

The insertion point is after the second row of photos. On a desktop three-column grid, this is after the sixth photo card. On mobile (single column), after the second photo card. The block sits as a full-width section between the photo rows, and the feed continues below it.

The placement is a deliberate compromise. After row one would maximize visibility but feel intrusive after only three photos of context. After row three would match Reddit and Instagram patterns but be invisible to short-session users — and surfacing communities to short-session users is a primary goal of this work.

## Concrete behavior

The community block renders only on the home feed, not on `/photos/<id>`, `/communities/<slug>`, or any filtered tab that already has strong community context. Within a session, the block does not re-anchor on tab change. Switching from `Recent` to `Following` should suppress the block entirely on non-default tabs to avoid duplicate impressions, and never duplicate it inside a single tab when the user paginates back to page one.

The block contains exactly one of the three widget variants shown in a rotation, not all three at once. The earlier sidebar showed all three stacked, which was the main visual-noise complaint. The variants are:

The "your communities" variant appears for signed-in users who have joined at least one community. It lists up to four joined communities as horizontal cards.

The "trending communities" variant appears for signed-out users and for signed-in users with zero joined communities. It lists the top four communities by member count as horizontal cards with a join button on each.

The "latest discussions" variant appears for signed-in users who have at least one joined community AND there is at least one forum thread updated in the last seven days inside one of those communities. It lists up to three threads with title, community attribution, and reply count.

Selection precedence when multiple variants are eligible: latest discussions > your communities > trending communities. This biases the surface toward the highest-engagement signal.

Rotation granularity is per page load. Per-day was considered but risks staleness when users visit multiple times in a day. Per-render was considered but would flicker on tab change. Per page load is the predictable middle ground.

The block is only rendered on the first page of the paginated feed. Inserting it on every page would mean a community block appearing five rows deep on page seven, which is below typical scroll depth and would have negligible discovery value.

## Dismissal

Authenticated users see a small close affordance in the top-right of the block. Clicking it permanently dismisses the surface for that user across all devices and sessions. The close button optimistically hides the block, then calls the `dismissFeedWidget` mutation with `widgetId: "home_community_block"`. The mutation is idempotent, so a stale optimistic update or a network retry never corrupts state.

Signed-out users see no close button. The block is part of the signup conversion funnel for them; dismissing it would defeat its purpose.

The implementation uses a single `dismissedFeedWidgets` `TEXT[]` column on the users table. Future widget surfaces (e.g. an onboarding banner, a billing-issue interstitial) can reuse the column with their own widget IDs without further migrations. The resolver enforces a 64-character cap on individual widget IDs and a 100-entry cap on the array to defend against pathological input.

## Layout

The block spans the full content width and is visually distinct from photo cards through whitespace and a subtle background tint, but explicitly does not use a strong border, accent bar, or large heading that would compete with the photos above and below. Approximate target heights are 160 to 200 pixels on desktop and 140 to 160 pixels on mobile.

The block must collapse cleanly when an ad slot is also configured. The current `feedAdSlot` injects an `<AdBanner />` between the hero and the photo grid; the new community block sits after row two, so there is no positional collision. The visual order top-to-bottom is hero, ad (if configured), photo rows one and two, community block, remaining photo rows.

The wiring approach is **split rendering, no `<PhotoGrid>` changes.** The home page renders two `<PhotoGrid>` instances (photos 0 to N before the block, photos N onward after) with the `<CommunityFeedBlock>` between them. This keeps `<PhotoGrid>` focused on its single responsibility — rendering photos in a grid — and lets future surfaces compose into the page without invasive grid changes. An earlier draft proposed an `injectAt` prop on `<PhotoGrid>`, but split rendering is cleaner: each grid is its own container, the block between them is a plain block element with no grid-spanning required, and additional surfaces compose at the page level rather than inside `<PhotoGrid>`.

## API surface (already shipped)

These additions are on `main` and ready for the web implementation to consume.

The `User.dismissedFeedWidgets: [String!]` field exposes the per-user list to the account owner only (null for any other caller, mirroring the privacy pattern used by `email`, `failedAttempts`, and `lockoutUntil`).

The `Mutation.dismissFeedWidget(widgetId: String!): User!` mutation appends a widget ID idempotently, returning the updated user with `profile` and `sellerProfile` included so the client cache (urql, keyed on `me`) refreshes in one round trip.

The `Query.communities(sort: CommunitySort = recent)` argument supports `recent` (default, by `createdAt` desc) and `popular` (by member count desc, with `createdAt` desc as a tiebreaker for deterministic pagination).

The `Query.recentForumThreads(first: Int = 5): [ForumThread!]!` resolver returns up to 20 of the most recently active threads across all categories, soft-delete-aware. Default of 5 is sized for compact recent-threads strips.

The `Query.photos(communityIds: [ID!])` argument restricts results to photos whose album belongs to one of the given communities. Empty array is treated as "filter not applied" rather than "match nothing" to avoid surprising callers when a user has zero joined communities.

The `Photo.community` field resolver returns the photo's community via `photo.album.community` (zero extra queries when the parent included it; one indexed lookup otherwise).

The `ForumCategory.community` field resolver returns the category's community, or null for global categories.

These additions live in `apps/api/src/schema.ts` and the corresponding `apps/api/src/resolvers/*.ts` files, with vitest coverage in `apps/api/src/__tests__/homeFeed.test.ts` (community-context queries) and `apps/api/src/__tests__/dismissFeedWidget.test.ts`.

## Web implementation (pending)

A `<CommunityFeedBlock>` component handles variant selection, data fetching, and the close affordance. It accepts no props in the simplest form; it reads auth state internally to decide which variant to render. Roughly 150 lines including the three variants and the selection logic.

The home page (`apps/web/src/app/page.tsx`) splits the photos array around the block. On desktop, photos 0–5 in the first `<PhotoGrid>`, the block, then photos 6–N in the second. On mobile, photos 0–1 and 2–N respectively. A small `useResponsiveSplitIndex()` hook returns 6 or 2 based on viewport.

The block calls the `dismissFeedWidget` mutation on close, with optimistic-update semantics so the UI hides instantly. The mutation's response updates the cached `me`, which causes future renders to short-circuit on the dismiss check.

GraphQL operations to add to `apps/web/src/lib/queries.ts`: `MY_COMMUNITIES` (for the "your communities" variant), `GET_COMMUNITIES` with the `sort: popular` arg (trending), `GET_RECENT_FORUM_THREADS` (latest discussions), and `DISMISS_FEED_WIDGET` (the mutation).

Tests cover variant-selection precedence (four cases), the dismissal flow (calls mutation, optimistically hides), rotation determinism within a page load, and the responsive split-index hook.

## Pre-existing follow-ups (not blocked by this work, not in scope)

The `apps/api/src/__tests__/admin.test.ts > adminStats` test is internally inconsistent: it creates a single pending photo and asserts both `totalPhotos === 1` and `pendingPhotos === 1`, while the resolver only counts approved photos in `totalPhotos`. Reproducible on `2bd2333d`.

A lint error in `apps/web/src/components/AirportPicker.tsx:52:7` reports `react-hooks/set-state-in-effect`. Pre-existing.

`next build` fails to prerender `/_global-error` with `TypeError: Cannot read properties of null (reading 'useContext')`. Reproducible on a clean main and blocks production builds.

`packages/db/prisma/seed.ts` does not write a bcrypt `passwordHash` for any user (it only writes a sha256-derived `cognitoSub`) and leaves `status` defaulted to `pending` for three of the four seeded users. A fresh dev environment cannot sign in with any seeded account until the hash and status are backfilled.

`apps/api/.env` ships with `WEB_BASE_URL=https://www.spotterspace.com`, which excludes `http://localhost:3000` from the API's CSRF allowlist and breaks the BFF-to-API signin flow on a fresh dev setup until overridden at API launch.

The vitest API suite has occasional flake when run in parallel: tests that share `cleanDatabase` (a `TRUNCATE ... CASCADE` of every table) can fail mid-truncate when another test file's transaction is in flight against the same tables. Re-running the suite typically passes. The flake is not caused by this work and reproduces on a clean main.
