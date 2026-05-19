# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Build arguments for Next.js public env vars
ARG NEXT_PUBLIC_API_URL=http://api.spotterspace.com/graphql
ARG NEXT_PUBLIC_MAPBOX_TOKEN

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN

# Context is the monorepo root
# Copy root workspace files first
COPY package.json package-lock.json ./
COPY turbo.json ./

# Copy all package.json files for workspace dep resolution
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

# Copy tsconfig files for packages (needed for compilation)
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/db/tsconfig.json ./packages/db/
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/web/tsconfig.json ./apps/web/

# Install dependencies (npm workspaces resolve local packages from filesystem)
RUN npm install --ignore-scripts

# Copy source for all packages
COPY packages/shared/src ./packages/shared/src
COPY packages/db/src ./packages/db/src
COPY packages/db/prisma ./packages/db/prisma
COPY apps/api/src ./apps/api/src
COPY apps/web/src ./apps/web/src
COPY apps/web/next.config.ts ./apps/web/
COPY apps/web/public ./apps/web/public
COPY tsconfig.base.json ./

# Build packages individually (explicit project paths for tsc)
# The tsconfig.json extends ../../tsconfig.base.json which is at /app/tsconfig.base.json
# We pass TSCCONFIG_BASE so tsc can find it
ENV TSCCONFIG_BASE=/app
RUN cd /app/packages/shared && cp /app/tsconfig.base.json ./tsconfig.base.json && npx tsc -p tsconfig.json
RUN cd /app/packages/db && cp /app/tsconfig.base.json ./tsconfig.base.json && npx prisma generate --schema prisma/schema.prisma && npx tsc -p tsconfig.json
RUN cd /app/apps/api && cp /app/tsconfig.base.json ./tsconfig.base.json && npx tsc -p tsconfig.json

# Build web app + copy standalone output to runtime
RUN cd /app/apps/web && npx next build

# Skip pruning - image size doesn't matter for App Runner

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the entire standalone output preserving its monorepo mirror structure.
# This places server.js at /app/apps/web/server.js and .next/server alongside it.
COPY --from=builder /app/apps/web/.next/standalone ./

# Copy static assets to where server.js expects them after chdir.
# server.js does process.chdir(__dirname) → /app/apps/web/
# then looks for .next/static relative to that.
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Copy public directory alongside server.js
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]