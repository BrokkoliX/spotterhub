-- Adds a per-user dismissal list for in-feed widget surfaces.
--
-- Context: the home feed will (re-)introduce a community-context block
-- inserted between rows of the photo grid. Authenticated users can
-- permanently dismiss any such surface from their account, and the
-- dismissal must persist across devices and sessions, which rules out
-- localStorage / sessionStorage.
--
-- Shape choice: a TEXT[] of widget identifiers rather than a single
-- boolean so future widget surfaces (e.g. an onboarding banner, a
-- billing-issue interstitial) can use the same column without further
-- migrations. Each widget passes its own stable identifier when calling
-- the dismissFeedWidget mutation; the resolver appends to this array
-- only when the identifier is not already present (idempotent).
--
-- Default '{}' (empty array, NOT NULL) keeps reads simple — no caller
-- has to handle null vs. empty-list — and matches Postgres' standard
-- pattern for set-valued columns. The `IF NOT EXISTS` guard makes the
-- migration safe to re-run against partially-migrated databases.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "dismissed_feed_widgets" TEXT[] NOT NULL DEFAULT '{}';
