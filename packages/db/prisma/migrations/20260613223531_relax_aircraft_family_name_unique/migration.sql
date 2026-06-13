-- Relax the global @unique on aircraft_families.name so that the same family
-- name can exist under different manufacturers (e.g. an "A320" by Airbus and
-- a license-built "A320" by another manufacturer are distinct families).
-- Family name is now unique per manufacturer via a compound unique, matching
-- the pattern used for airlines (see 20260611000000_drop_airline_code_unique).

-- DropIndex
DROP INDEX IF EXISTS "aircraft_families_name_key";

-- CreateIndex (non-unique index on name for search/upsert performance)
CREATE INDEX IF NOT EXISTS "aircraft_families_name_idx" ON "aircraft_families"("name");

-- Add the compound unique constraint: same family name allowed under
-- different manufacturers, but unique per manufacturer.
ALTER TABLE "aircraft_families" ADD CONSTRAINT "aircraft_families_name_manufacturer_id_key" UNIQUE ("name", "manufacturer_id");
