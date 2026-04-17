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

npx prisma migrate deploy --schema /app/prisma/schema.prisma
echo "✅ Migrations complete"

echo "Starting API server..."
exec node dist/index.js
