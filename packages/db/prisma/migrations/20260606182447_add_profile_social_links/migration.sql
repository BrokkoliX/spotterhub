-- Adds optional social-media link fields to user profiles.
--
-- Context: SpotterHub is a community platform for aviation photographers,
-- many of whom maintain a presence on Instagram, Facebook, and X (Twitter)
-- where they cross-post their work. Surfacing those links on the public
-- profile lets visitors follow a photographer outside the platform.
--
-- Shape choice: discrete nullable TEXT columns rather than a JSON blob or
-- a separate `social_links` table. The set of supported platforms is small
-- and fixed, every platform has its own validation/display rules, and this
-- pattern matches every other user-edited scalar already on `profiles`
-- (bio, gear, location_region, etc.). A JSON column would forfeit
-- per-field validation and indexing options; a side table would be
-- over-engineered for a 1:1 relationship with at most three values.
--
-- Storage convention: handle fields (instagram_handle, x_handle) hold the
-- bare username with no leading '@' and no URL prefix. The updateProfile
-- resolver strips '@' characters and well-known URL prefixes before write
-- so paste-from-browser still works for the user. facebook_url is stored
-- as a full URL because Facebook profile URLs are heterogeneous (vanity
-- usernames, numeric IDs, /profile.php?id=…) and there is no clean
-- canonical 'handle' form.
--
-- All columns are nullable — null means "not set" — and the IF NOT EXISTS
-- guards keep the migration idempotent against partially-migrated
-- databases, matching the project convention established in the
-- 20260529000000_add_dismissed_feed_widgets migration.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "instagram_handle" TEXT,
  ADD COLUMN IF NOT EXISTS "facebook_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "x_handle"         TEXT;
