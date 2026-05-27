# Badge System

How the badge system in SpotterHub is structured today, where it works, where it does not, and how to operate it.

## TL;DR

The badge system has solid bones — schema, resolvers, an award engine, and an admin definitions page — but it is only partially wired. Three things are broken or missing in the current state.

The first issue is that `checkAndAwardBadges` is only invoked from the photo upload mutation, so badges tied to likes received, comments written, communities joined, and communities created can never be earned automatically. The second issue is that `packages/db/prisma/seed-badges.ts` is not executed by `db:seed`, so a freshly seeded database has no badge definitions at all. The third issue is that the `awardBadge` and `revokeBadge` GraphQL mutations are exposed but no admin UI consumes them, so manually granted badges (Photo of the Day, Editor's Pick, etc.) cannot be assigned without writing GraphQL by hand.

The rest of this document walks the architecture top to bottom, lists every gap, and shows how to set things up with copy-pasteable examples.

## Architecture Overview

The system has four moving parts: a Prisma schema, a GraphQL surface, an automatic award engine, and the admin / display UI. They live in these locations.

```text
packages/db/prisma/schema.prisma         # BadgeDefinition, UserBadge, PhotoAward models + enums
packages/db/prisma/seed-badges.ts        # Seed file with 22 default badges (NOT wired into db:seed)
apps/api/src/schema.ts                   # GraphQL types, queries, mutations, inputs
apps/api/src/resolvers/badgeResolvers.ts # Query/mutation/field resolvers + checkAndAwardBadges engine
apps/api/src/resolvers/photoResolvers.ts # The ONLY place checkAndAwardBadges is called today
apps/api/src/resolvers/userResolvers.ts  # User.badges field resolver (read-only)
apps/web/src/app/admin/badges/page.tsx   # Admin page — definitions CRUD only, no awarding
apps/web/src/app/u/[username]/photos/    # User profile page — renders earned badges
apps/web/src/lib/queries.ts              # GraphQL operation strings (incl. AWARD_BADGE, REVOKE_BADGE)
```

## Data Model

A badge has two layers. The first layer is `BadgeDefinition`, which describes a badge that exists in the system: its slug, name, description, optional icon, category, tier, trigger type, and (for automatic badges) which metric and threshold trigger it. The second layer is `UserBadge`, the join row recording that a specific user earned a specific badge at a specific time, optionally tied to a specific photo and an awarder.

Categories and tiers are enums. Categories are `UPLOAD`, `ENGAGEMENT`, `COMMUNITY`, `STREAK`, `DIVERSITY`, and `AWARD`. Tiers are `BRONZE`, `SILVER`, `GOLD`, and `PLATINUM`. Trigger types are `AUTOMATIC` (engine-evaluated against a metric) or `AWARDED` (manually granted by a superuser).

The unique constraint `@@unique([userId, badgeDefinitionId])` on `UserBadge` prevents the same badge being granted to a user twice. The shape of the relevant tables, in code form:

```prisma
model BadgeDefinition {
  id               String           @id @default(uuid()) @db.Uuid
  slug             String           @unique
  name             String
  description      String
  iconUrl          String?
  category         BadgeCategory
  tier             BadgeTier
  triggerType      BadgeTriggerType
  triggerMetric    String?
  triggerThreshold Int?
  isActive         Boolean          @default(true)
  displayOrder     Int              @default(0)
  userBadges       UserBadge[]
}

model UserBadge {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @db.Uuid
  badgeDefinitionId String   @db.Uuid
  awardedAt         DateTime @default(now())
  awardedPhotoId    String?  @db.Uuid
  awardedBy         String?  @db.Uuid
  @@unique([userId, badgeDefinitionId])
}
```

## The Award Engine

The function `checkAndAwardBadges(ctx, userId, metric)` in `apps/api/src/resolvers/badgeResolvers.ts` is the heart of the automatic system. It loads every active badge definition with `triggerType = AUTOMATIC` matching the supplied metric, computes the user's current value for that metric via `computeMetricValue`, and inserts `UserBadge` rows for every threshold the user has crossed (skipping any already earned). For each new award it also creates a `badge_earned` notification.

The engine knows how to compute these metrics out of the box. Each entry below is in the format **metric name** → SQL it ultimately runs against:

The metric `photo_count` counts approved photos owned by the user. The metric `like_received_count` sums `likeCount` across the user's approved photos. The metric `comment_count` counts all comments authored by the user. The metric `community_join_count` counts `CommunityMember` rows for the user. The metric `community_created_count` counts communities owned by the user. The metric `unique_airport_count` counts distinct `airportCode` values across the user's approved photos. The metric `upload_streak_days` runs raw SQL over distinct `DATE(created_at)` values to find the current consecutive-day streak.

Adding a new automatic metric requires two steps. First, decide a slug like `photo_view_count`. Second, add a `case` to the `switch` in `computeMetricValue` that returns a number for that user. Once defined, any badge definition with `triggerMetric = 'photo_view_count'` and an integer `triggerThreshold` will be evaluated against it whenever something calls `checkAndAwardBadges(ctx, userId, 'photo_view_count')`.

## What Is Wired (And What Is Not)

The engine is currently called from exactly one place — the `uploadPhoto` resolver in `photoResolvers.ts`:

```ts
// apps/api/src/resolvers/photoResolvers.ts (around line 637)
checkAndAwardBadges(ctx, user.id, 'photo_count').catch(() => {});
checkAndAwardBadges(ctx, user.id, 'unique_airport_count').catch(() => {});
checkAndAwardBadges(ctx, user.id, 'upload_streak_days').catch(() => {});
```

That means three of the seven metrics are evaluated today. The remaining four (`like_received_count`, `comment_count`, `community_join_count`, `community_created_count`) are defined in the engine and seeded as badges, but no resolver ever calls the engine for those metrics, so they will never fire.

The pattern these calls follow is fire-and-forget — failures are swallowed so badge errors cannot break the underlying mutation. To wire up the missing metrics, add equivalent calls in the relevant mutation resolvers as shown below.

The like-received metric should be evaluated on the photo owner whenever a like is added. In `apps/api/src/resolvers/likeResolvers.ts`, after the transaction that increments `likeCount`, look up the photo's `userId` and call:

```ts
const photo = await ctx.prisma.photo.findUnique({
  where: { id: args.photoId },
  select: { userId: true },
});
if (photo) checkAndAwardBadges(ctx, photo.userId, 'like_received_count').catch(() => {});
```

The comment metric should be evaluated on the comment author after `addComment` in `apps/api/src/resolvers/commentResolvers.ts`:

```ts
checkAndAwardBadges(ctx, userId, 'comment_count').catch(() => {});
```

The community-join metric should be evaluated on the joiner inside `joinCommunity` in `apps/api/src/resolvers/communityResolvers.ts` after the membership row is created. The community-creation metric should be evaluated on the owner inside `createCommunity` in the same file. Both are one-line additions that mirror the upload pattern.

## Manual Awards Have No UI

The GraphQL mutations `awardBadge(userId, badgeDefinitionId, photoId)` and `revokeBadge(userId, badgeDefinitionId)` are implemented and gated to superusers. The corresponding `AWARD_BADGE` and `REVOKE_BADGE` queries are exported from `apps/web/src/lib/queries.ts`. Despite this, no React component imports them — `apps/web/src/app/admin/badges/page.tsx` only manages definitions, not awards.

This means `AWARDED` badges (Photo of the Day, Photo of the Week, Photo of the Month, Editor's Pick) cannot currently be granted from the admin interface. Until a UI is built they have to be granted directly via a GraphQL client. An example mutation, in the format you would paste into a GraphQL playground or Apollo Sandbox while logged in as a superuser:

```graphql
mutation {
  awardBadge(
    userId: "00000000-0000-0000-0000-000000000000"
    badgeDefinitionId: "11111111-1111-1111-1111-111111111111"
    photoId: "22222222-2222-2222-2222-222222222222"
  ) {
    id
    awardedAt
    badgeDefinition {
      slug
      name
      tier
    }
  }
}
```

## Setting Up Badges Locally

Step one is to create the badge definitions. The seed file `packages/db/prisma/seed-badges.ts` upserts 22 defaults covering every category and tier. It is not part of the master `db:seed` command, so run it explicitly from the repo root:

```bash
cd packages/db && npx tsx prisma/seed-badges.ts
```

Expected output is a single line: `Done — 22 badge definitions in database.` Re-running is safe; the script uses `prisma.badgeDefinition.upsert` keyed on slug.

Step two is to verify the definitions landed. Open `/admin/badges` while logged in as an admin or superuser. The table should list 22 rows grouped by category. The category filter dropdown lets you focus on one category at a time.

Step three is to verify the engine. Upload a photo as a normal user. Within the same request, three engine calls fire. The user should now own the `spotter-bronze` badge (1 photo uploaded), and a notification with `type = badge_earned` should land in their feed. Confirm via the database:

```sql
SELECT u.username, bd.slug, bd.tier, ub.awarded_at
FROM user_badges ub
JOIN users u ON u.id = ub.user_id
JOIN badge_definitions bd ON bd.id = ub.badge_definition_id
ORDER BY ub.awarded_at DESC LIMIT 5;
```

Step four, optional, is to wire `seed-badges.ts` into the master seed so future `db:reset` cycles include badges. Edit `packages/db/prisma/seed.ts` and import the seed file's main function, or add `db:seed-badges` and `db:seed:all` scripts to `packages/db/package.json` mirroring the existing `db:seed-aircraft` pattern.

## Defining a Custom Badge

Two ways exist to add a new badge. The first is via the admin UI at `/admin/badges`, clicking **+ New Badge** and filling out the form. This is sufficient for ad-hoc additions but the form lives only in memory of one DB and is not version-controlled.

The second way, recommended for badges that should ship with the product, is to add an entry to the `BADGES` array in `packages/db/prisma/seed-badges.ts` and re-run the seed. Each entry follows the `BadgeSeed` interface defined at the top of that file. An example entry that grants a gold badge to anyone who has uploaded photos at 100 different airports:

```ts
{
  slug: 'explorer-platinum',
  name: 'Globe Trotter',
  description: 'Photograph at 100 different airports',
  category: 'DIVERSITY',
  tier: 'PLATINUM',
  triggerType: 'AUTOMATIC',
  triggerMetric: 'unique_airport_count',
  triggerThreshold: 100,
  displayOrder: 503,
}
```

For an `AWARDED` badge, omit `triggerMetric` and `triggerThreshold`. An example entry for a manually-granted lifetime achievement badge:

```ts
{
  slug: 'pioneer',
  name: 'Pioneer',
  description: 'Among the first 100 spotters on the platform',
  category: 'AWARD',
  tier: 'PLATINUM',
  triggerType: 'AWARDED',
  displayOrder: 700,
}
```

## Where Badges Are Displayed

User profile pages at `/u/[username]/photos` render a "Badges" section beneath the profile header, mapping over `user.badges` returned by the `User` GraphQL type. The grid styles by tier with classes like `styles.badgeTierBronze` through `styles.badgeTierPlatinum`. The category icon comes from a small helper at the top of the same file:

```ts
function getBadgeCategoryIcon(category: string): string {
  switch (category) {
    case 'UPLOAD':
      return '📸';
    case 'ENGAGEMENT':
      return '❤️';
    // ...
  }
}
```

Photo cards do not display badges. Notifications include badge events when the engine awards one — those land in the existing notifications feed via the `badge_earned` notification type.

## Backfilling Existing Users

Adding a new automatic badge does not retroactively grant it to users who already crossed the threshold. The engine only runs when a triggering action happens. To backfill, run a one-off script that loops over users and calls `checkAndAwardBadges` for each relevant metric. The pattern, as a script you would place under `scripts/`:

```ts
import { PrismaClient } from '@prisma/client';
import { checkAndAwardBadges } from '../apps/api/src/resolvers/badgeResolvers';

const prisma = new PrismaClient();
const ctx = { prisma } as never; // mock minimal Context

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await checkAndAwardBadges(ctx, u.id, 'photo_count');
    await checkAndAwardBadges(ctx, u.id, 'unique_airport_count');
    await checkAndAwardBadges(ctx, u.id, 'upload_streak_days');
  }
}
main().finally(() => prisma.$disconnect());
```

This pattern doubles as the way to retroactively grant badges after wiring up `like_received_count`, `comment_count`, `community_join_count`, or `community_created_count`.

## Recommended Next Steps

The minimum work required to make the badge system fully functional, in priority order: wire the four missing metric calls into `likeResolvers`, `commentResolvers`, and `communityResolvers`; add a "Grant badge" UI to the admin badges page that uses `AWARD_BADGE` against a user picker; add `seed-badges.ts` into the main seed pipeline; and add a vitest covering `checkAndAwardBadges` end-to-end (definitions → metric → award row → notification). With those four changes the system moves from "scaffolded" to "production-ready".
