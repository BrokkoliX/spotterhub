-- Drop the legacy aircraft_type column if it exists.
-- This column was added outside of Prisma migrations and is not in the schema.
-- The aircraft hierarchy now uses manufacturer_id / family_id / variant_id.
ALTER TABLE "aircraft" DROP COLUMN IF EXISTS "aircraft_type";
