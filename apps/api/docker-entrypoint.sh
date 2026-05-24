#!/bin/sh
set -e

# ─── Optional database migrations ────────────────────────────────────────────
#
# Migrations only run when RUN_MIGRATIONS=true. By default — i.e. for normal
# task replacements (deploys, OOM recovery, autoscaling, ALB-driven restarts)
# — we skip this step entirely and start the API in a few seconds.
#
# Why: running `prisma migrate deploy` on every cold boot added 5-15 seconds
# to startup, and a single failing migration would cause every newly placed
# task to crash-loop, producing the multi-minute portal outages the team has
# been seeing. The CI/CD pipeline now triggers migrations explicitly via a
# one-off ECS RunTask (or the `apply-migrations` workflow step) BEFORE the
# rolling deploy of the API service, so production tasks never need to.
#
# To run migrations from inside an existing image, override the task command
# to: ["sh", "-c", "RUN_MIGRATIONS=true /app/docker-entrypoint.sh"]
# or run a one-off ECS task with RUN_MIGRATIONS=true in the environment.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy --schema /app/prisma/schema.prisma
  echo "✅ Migrations complete"
else
  echo "Skipping migrations (set RUN_MIGRATIONS=true to enable)."
fi

# ─── Optional one-off: backfill display variants ─────────────────────────────
#
# Regenerates `display` (and other) image variants for every existing photo
# at the size defined by `IMAGE_VARIANT_SIZES.display` in @spotterspace/shared.
# Used after bumping the display long-edge so existing uploads catch up to the
# new size instead of permanently displaying at the old smaller size.
#
# Only runs when RUN_BACKFILL_DISPLAY_VARIANTS=true. The script self-exits
# when complete, so the ECS task lifecycle is bounded by the script's own
# duration. Any args passed to the entrypoint are forwarded as CLI flags
# (e.g. --dry-run, --limit 10).
#
# Example one-off ECS task command override:
#   ["sh", "-c", "RUN_BACKFILL_DISPLAY_VARIANTS=true /docker-entrypoint.sh --dry-run"]
if [ "$RUN_BACKFILL_DISPLAY_VARIANTS" = "true" ]; then
  echo "Running display-variant backfill..."
  exec node dist/scripts/backfillDisplayVariants.js "$@"
fi

# If arguments were passed (e.g. via ECS command override), run them
# instead of the default API server. This enables one-off tasks.
if [ $# -gt 0 ]; then
  echo "Running command override: $*"
  exec "$@"
fi

echo "Starting API server..."
exec node dist/index.js
