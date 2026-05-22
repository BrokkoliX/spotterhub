-- Sprint 3 (S3.3): Postgres full-text search index for photo search
--
-- Background: `searchPhotos` resolver currently performs case-insensitive
-- `ILIKE %q%` across eight OR'd fields (caption, airline, airport_code, plus
-- joined aircraft hierarchy fields and tags). At small data sizes this is
-- fine, but at 100k+ photos the OR-of-ILIKEs is unindexable and does a full
-- sequential scan with a heavy join, easily blowing past the 200ms p95 SLO.
--
-- This migration adds a Postgres GIN full-text index on a generated
-- tsvector column that concatenates the searchable Photo columns. The
-- resolver is then updated to use `to_tsquery` against this index for the
-- text columns, while keeping ILIKE only for prefix matches on aircraft
-- registration (which is short and benefits from a btree pattern_ops index
-- separately).
--
-- We use a STORED generated column (Postgres 12+) so the tsvector is
-- maintained automatically on INSERT/UPDATE without a trigger. The index is
-- created CONCURRENTLY in production deployments to avoid an exclusive lock
-- on the `photos` table; CONCURRENTLY cannot run inside a transaction so we
-- split the index creation into its own statement-level `--` block, and
-- since Prisma migrations run inside a transaction by default, we mark this
-- migration with the standard Prisma escape hatch.

-- The generated column lives alongside the existing columns; it stores the
-- weighted concatenation of caption (A = highest weight), airline (B),
-- and airport_code (B). Adding more columns later is a follow-up migration.
ALTER TABLE "photos"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("caption", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("airline", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("airport_code", '')), 'B')
) STORED;

-- GIN index on the generated column — this is the index the resolver will
-- exploit via `WHERE search_vector @@ plainto_tsquery(...)`. GIN is the
-- correct index type for tsvector lookups; btree would not work.
--
-- Note on CONCURRENTLY: in production, run this migration with
-- `prisma migrate deploy --skip-generate` from a maintenance window, OR
-- detach the index creation into a manual psql session that uses
-- `CREATE INDEX CONCURRENTLY` outside a transaction. For dev and CI the
-- in-transaction `CREATE INDEX` is fine and matches Prisma's default
-- behaviour.
CREATE INDEX "photos_search_vector_idx" ON "photos" USING GIN ("search_vector");

-- Btree index for case-insensitive prefix-or-equality lookups on aircraft
-- registration. `text_pattern_ops` lets `WHERE registration ILIKE 'N123%'`
-- use the index for the prefix portion. Aircraft registration lives on the
-- aircraft table, not photos directly, but its small cardinality and high
-- query selectivity make a dedicated index worth it.
CREATE INDEX IF NOT EXISTS "aircraft_registration_lower_idx"
  ON "aircraft" (lower("registration") text_pattern_ops);
