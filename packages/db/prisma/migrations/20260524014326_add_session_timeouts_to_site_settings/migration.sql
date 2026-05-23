-- Add configurable JWT session lifetimes to SiteSettings.
--
-- These two columns replace the previously-hardcoded ACCESS_TOKEN_MAX_AGE
-- (3600) and REFRESH_TOKEN_MAX_AGE (604800) constants in the API. Defaults
-- preserve the prior behaviour exactly, so existing sessions are unaffected.
-- Superusers can adjust both at runtime from /admin/settings.

ALTER TABLE "site_settings"
  ADD COLUMN "access_token_seconds" INTEGER NOT NULL DEFAULT 3600,
  ADD COLUMN "refresh_token_seconds" INTEGER NOT NULL DEFAULT 604800;
