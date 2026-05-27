-- Add `is_repeatable` flag to badge definitions. Repeatable badges (e.g.
-- Admin's Choice of the Week, Photo of the Day) can be granted multiple
-- times to the same user, typically tied to a different photo each time.
ALTER TABLE "badge_definitions"
ADD COLUMN "is_repeatable" BOOLEAN NOT NULL DEFAULT false;

-- Drop the unique (user_id, badge_definition_id) constraint so repeatable
-- badges can be awarded multiple times. Dedup for non-repeatable badges
-- is now enforced at the application layer (see `checkAndAwardBadges` and
-- the `awardBadge` resolver).
ALTER TABLE "user_badges"
DROP CONSTRAINT IF EXISTS "user_badges_user_id_badge_definition_id_key";

DROP INDEX IF EXISTS "user_badges_user_id_badge_definition_id_key";
