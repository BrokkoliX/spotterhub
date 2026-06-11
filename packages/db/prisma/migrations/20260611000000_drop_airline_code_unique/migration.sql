-- Drop the unique constraints on airlines.icao_code and airlines.iata_code
-- so that multiple airlines may share an IATA/ICAO code (e.g. codeshare
-- parents, military units that reuse a commercial code, or a marketing
-- brand that exists alongside its operating subsidiaries). A non-unique
-- index is kept so the upsert and search lookups stay fast.

-- DropIndex
DROP INDEX IF EXISTS "airlines_icao_code_key";

-- DropIndex
DROP INDEX IF EXISTS "airlines_iata_code_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "airlines_icao_code_idx" ON "airlines"("icao_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "airlines_iata_code_idx" ON "airlines"("iata_code");
