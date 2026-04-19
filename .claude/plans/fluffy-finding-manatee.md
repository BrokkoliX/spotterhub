# Plan: Community Admin Moderation Powers

## Context

When a user creates a community, they become the `owner` (`CommunityRole: owner`). They need the ability to manage their community: ban members, delete photos, delete forum posts/threads, and delete comments — without requiring global platform admin status.

The schema already has `CommunityRole` enum with `owner`, `admin`, `moderator`, `member`. `CommunityModerationAction` includes `ban`, `unban`, `kick`, `delete_post`, `pin_thread`, etc. The `banCommunityMember` and `unbanCommunityMember` mutations already exist.

What's missing:
1. **Delete photo** — community owners/admins can delete any photo within their community
2. **Delete comment** — community owners/admins can delete any comment on community photos
3. **New mutations**: `deleteCommunityPhoto`, `deleteCommunityComment`, `deleteCommunityThread`, `deleteCommunityPost`
4. **Moderation logging** — all destructive actions logged to `CommunityModerationLog`

Forum thread/post delete already checks `roleWeight >= moderator` (includes owner/admin) — that's already correct.

---

## API Changes

### 1. Shared helpers

**File**: `apps/api/src/resolvers/communityResolvers.ts`

Add two helpers:

```typescript
/** Get community membership for a user. Returns null if not an active member. */
async function getMembership(ctx: Context, communityId: string, userId: string)

/** Check if user can moderate a community (owner/admin/moderator). */
async function canModerate(
  ctx: Context,
  communityId: string,
  userId: string,
): Promise<{ role: string } | null>

/** Log a moderation action to CommunityModerationLog. */
async function logModerationAction(
  ctx: Context,
  params: { communityId: string; moderatorId: string; targetUserId: string; action: CommunityModerationAction; reason?: string; metadata?: Json }
)
```

### 2. Extend `deletePhoto` for community admins

**File**: `apps/api/src/resolvers/photoResolvers.ts`

Modify `deletePhoto` — allow deletion if caller:
- Is photo owner (existing check)
- Is global admin/superuser (existing check)
- Is `owner`/`admin`/`moderator` of a community that the photo belongs to

To find community for a photo: trace `photo → album (if community album) → communityId`.

### 3. Extend `deleteComment` for community admins

**File**: `apps/api/src/resolvers/commentResolvers.ts`

Modify `deleteComment` — allow deletion if caller:
- Is comment author (existing check)
- Is global admin/superuser
- Is moderator+ of the photo's community: trace `comment → photo → album (if community album) → communityId`

### 4. New mutations for community-scoped deletion

**File**: `apps/api/src/resolvers/communityResolvers.ts`

Add four new mutations that always log to moderation log:

```typescript
deleteCommunityPhoto: async (
  _parent: unknown,
  args: { communityId: string; photoId: string; reason?: string },
  ctx: Context,
) => {
  // Verify caller is moderator+
  // Trace photo → album → community
  // Log action
  // Delete photo
  return true;
}

deleteCommunityComment: async (
  _parent: unknown,
  args: { communityId: string; commentId: string; reason?: string },
  ctx: Context,
) => {
  // Verify caller is moderator+
  // Trace comment → photo → album → community
  // Log action
  // Delete comment
  return true;
}

deleteCommunityThread: async (
  _parent: unknown,
  args: { communityId: string; threadId: string; reason?: string },
  ctx: Context,
) => {
  // Verify caller is moderator+
  // Log action
  // Delete thread (cascade deletes posts)
  return true;
}

deleteCommunityPost: async (
  _parent: unknown,
  args: { communityId: string; postId: string; reason?: string },
  ctx: Context,
) => {
  // Verify caller is moderator+
  // Log action (soft-delete: set isDeleted=true, body='[deleted]')
  return true;
}
```

Note: `deleteForumThread` and `deleteForumPost` in `forumResolvers.ts` already check moderator+ role — but they don't log to moderation log. The new community mutations wrap them with logging. We can either:
- A) Keep separate `deleteCommunityX` mutations that call the existing ones then log
- B) Add logging directly to the existing forum resolvers when communityId != null

Option B is cleaner — modify `deleteForumThread` and `deleteForumPost` in `forumResolvers.ts` to log when community-scoped.

### 5. GraphQL schema additions

**File**: `apps/api/src/schema.ts`

Add to Mutation type:
```graphql
"""Delete a photo in a community. Requires owner, admin, or moderator role. Logs the action."""
deleteCommunityPhoto(communityId: ID!, photoId: ID!, reason: String): Boolean!

"""Delete a comment in a community. Requires owner, admin, or moderator role. Logs the action."""
deleteCommunityComment(communityId: ID!, commentId: ID!, reason: String): Boolean!

"""Delete a forum thread in a community. Requires moderator+ role. Logs the action."""
deleteCommunityThread(communityId: ID!, threadId: ID!, reason: String): Boolean!

"""Soft-delete a forum post in a community. Requires moderator+ role. Logs the action."""
deleteCommunityPost(communityId: ID!, postId: ID!, reason: String): Boolean!
```

---

## Frontend Changes

### 6. Community moderation page

**New page**: `apps/web/src/app/communities/[slug]/moderate/page.tsx`
- Lists members with role management (promote/demote/bankick)
- Lists recent moderation log entries
- Actions to delete photos, comments, threads

**Components**:
- `apps/web/src/components/CommunityModActions.tsx` — inline delete/ban buttons shown to admins viewing community content

### 7. Navigation

Add "Moderation" sidebar link to `apps/web/src/app/communities/[slug]/page.tsx` for owner/admin/moderator members.

---

## Files to Modify

| File | Action |
|---|---|
| `apps/api/src/schema.ts` | Add 4 new mutations |
| `apps/api/src/resolvers/photoResolvers.ts` | Extend `deletePhoto` with community admin check |
| `apps/api/src/resolvers/commentResolvers.ts` | Extend `deleteComment` with community admin check |
| `apps/api/src/resolvers/forumResolvers.ts` | Add moderation logging to `deleteForumThread`, `deleteForumPost` when community-scoped |
| `apps/api/src/resolvers/communityResolvers.ts` | Add `logModerationAction` helper + 4 new mutations |
| `apps/web/src/app/communities/[slug]/moderate/page.tsx` | **NEW** — community moderation UI |
| `apps/web/src/components/CommunityModActions.tsx` | **NEW** — inline mod action buttons |
| `apps/web/src/lib/queries.ts` | Add new GraphQL mutations |
| `apps/web/src/app/communities/[slug]/page.tsx` | Add Moderation nav link for mods+ |

---

## Verification

1. `cd apps/api && npx tsc` — compiles
2. `cd apps/web && npx next build` — compiles
3. Create a community, add another user, upload a photo to the community
4. As community owner/admin, delete the photo via new mutation — should succeed
5. Check `CommunityModerationLog` table — action should be logged
6. As regular member, try to delete admin's photo — should get FORBIDDEN error
