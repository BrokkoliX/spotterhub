-- Fix photos where operator_icao contains an airline DB UUID instead of the actual ICAO code.
-- The airlines table has id=UUID and icaoCode='AAL' format.
--
-- Run this against the production database:
--   psql "YOUR_PROD_DATABASE_URL" -f scripts/fix-operator-icao.sql
--
-- Or from a deployment shell:
--   npm run db:migrate:prod -- --name fix-operator-icao

-- Step 1: Find photos with UUID-looking operator_icao values (contain '-' and are >10 chars)
-- Step 2: Match them to airlines.id, then update operator_icao to airlines.icaoCode

UPDATE photos
SET operator_icao = a.icao_code
FROM airlines a
WHERE photos.operator_icao = a.id
  AND photos.operator_icao IS NOT NULL
  AND photos.operator_icao LIKE '%-%'
  AND length(photos.operator_icao) > 10;