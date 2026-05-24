-- Add a configurable map-refresh debounce window to SiteSettings.
--
-- This column replaces the previously-hardcoded 300 ms debounce in the web
-- map page. Superusers can adjust it at runtime from /admin/settings to make
-- calibration of the bounds-based airport/photo refetch easier. Default
-- preserves the prior behaviour exactly.

ALTER TABLE "site_settings"
  ADD COLUMN "map_refresh_debounce_ms" INTEGER NOT NULL DEFAULT 300;
