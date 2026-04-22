#!/bin/sh
set -e

echo "Running database migrations..."

# TODO: Remove this block after the first successful deploy.
# One-time reset: if old migration entries exist that are no longer in the
# migrations directory, clear the table and mark the squashed init as applied.
OLD_COUNT=$(npx prisma migrate status --schema /app/prisma/schema.prisma 2>&1 \
  | grep -c "not found locally" || true)
if [ "$OLD_COUNT" -gt 0 ]; then
  echo "Detected $OLD_COUNT old migrations — resetting history for squashed init..."
  echo "DELETE FROM _prisma_migrations;" | npx prisma db execute --schema /app/prisma/schema.prisma --stdin
  npx prisma migrate resolve --applied 20260417000000_init --schema /app/prisma/schema.prisma
  echo "✅ Migration history reset"
fi

# Attempt migration deploy. Handle two failure modes:
# 1. P3009: failed migration row blocking retry
# 2. P3018: migration recorded but failed partway through (corrupted state)
if ! npx prisma migrate deploy --schema /app/prisma/schema.prisma 2>&1; then
  echo "⚠️  migrate deploy failed — attempting recovery..."

  # Remove any failed migration rows that are blocking re-apply
  echo "DELETE FROM _prisma_migrations WHERE rolled_back_at IS NULL AND finished_at IS NULL;" \
    | npx prisma db execute --schema /app/prisma/schema.prisma --stdin 2>/dev/null || true

  # If the refresh_tokens table was created by a partially-applied migration,
  # drop it so the migration can re-run cleanly
  echo "DROP TABLE IF EXISTS refresh_tokens;" \
    | npx prisma db execute --schema /app/prisma/schema.prisma --stdin 2>/dev/null || true

  echo "Retrying migrate deploy..."
  npx prisma migrate deploy --schema /app/prisma/schema.prisma
fi
echo "✅ Migrations complete"

echo "Starting API server..."
exec node dist/index.js
