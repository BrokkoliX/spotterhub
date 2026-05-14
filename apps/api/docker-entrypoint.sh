#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema /app/prisma/schema.prisma
echo "✅ Migrations complete"

# If arguments were passed (e.g. via ECS command override), run them
# instead of the default API server. This enables one-off tasks.
if [ $# -gt 0 ]; then
  echo "Running command override: $*"
  exec "$@"
fi

echo "Starting API server..."
exec node dist/index.js
