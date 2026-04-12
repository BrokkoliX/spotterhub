# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy entire monorepo for proper workspace resolution
COPY . .

# Install all dependencies (devDependencies needed for TypeScript compilation)
# Using --ignore-scripts to skip husky install (no git repo in Docker)
RUN npm install --workspaces --ignore-scripts

# Generate Prisma client (binary targets are set in schema.prisma)
RUN DATABASE_URL="postgresql://placeholder" npx prisma generate --schema packages/db/prisma/schema.prisma

# Compile TypeScript (turbo discovers all workspaces and builds in dependency order)
RUN npx turbo run build --filter=@spotterhub/api

# Prune devDependencies from production image
RUN npm prune --production --workspace=@spotterhub/api

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install AWS CLI (for secrets fetching) and gzip
RUN apk add --no-cache aws-cli gzip

# Copy production node_modules and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./dist

# Copy prisma schema and migrations for migrate deploy
COPY --from=builder /app/packages/db/prisma ./prisma

# Set non-root user for App Runner
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001
USER nodeapp

ENV NODE_ENV=production
ENV API_PORT=4000

EXPOSE 4000

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

COPY --from=builder /app/apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
