-- Composite indexes to support the home feed sort modes.
--
-- Before this migration, the `photos(sortBy: ...)` resolver in
-- apps/api/src/resolvers/photoResolvers.ts ran:
--
--     SELECT ... FROM photos
--     WHERE moderation_status = 'approved' AND is_deleted = false
--       [AND created_at >= cutoff]
--     ORDER BY like_count DESC | created_at DESC
--     OFFSET ... LIMIT ...
--
-- with no composite index covering the filter + sort. On any non-trivial
-- table this becomes a sequential scan + in-memory sort, which the user
-- experienced as a slow load when picking Today / This Week / This Month /
-- All Time / Random on the home page. The accompanying COUNT(*) was equally
-- slow for the same reason.
--
-- We add three partial indexes (limited to the only rows the feed ever
-- looks at: approved + not deleted), which keeps them small and fast:
--
--   1) (created_at DESC) — speeds up the default Recent feed and the
--      cursor-based `created_at < cursor` pagination.
--   2) (like_count DESC, created_at DESC) — speeds up the popular sorts.
--      created_at is included as a deterministic tiebreaker and lets the
--      time-window popular sorts (Today/Week/Month) do an index range
--      scan after the like_count ordering.
--   3) (kind, created_at DESC) — covers the same Recent path when the
--      `kind` filter is applied (Aircraft / Community photo type tabs).
--
-- Using IF NOT EXISTS so re-running against a partially-migrated DB is
-- safe.

CREATE INDEX IF NOT EXISTS "photos_feed_recent_idx"
  ON "photos" ("created_at" DESC)
  WHERE "moderation_status" = 'approved' AND "is_deleted" = false;

CREATE INDEX IF NOT EXISTS "photos_feed_popular_idx"
  ON "photos" ("like_count" DESC, "created_at" DESC)
  WHERE "moderation_status" = 'approved' AND "is_deleted" = false;

CREATE INDEX IF NOT EXISTS "photos_feed_kind_recent_idx"
  ON "photos" ("kind", "created_at" DESC)
  WHERE "moderation_status" = 'approved' AND "is_deleted" = false;
