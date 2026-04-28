# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Copy entire monorepo for proper workspace resolution
COPY . .

# Install all dependencies (devDependencies needed for TypeScript compilation)
# Using --ignore-scripts to skip husky install (no git repo in Docker)
RUN npm install --workspaces --ignore-scripts

# Generate Prisma client (binary targets are set in schema.prisma)
RUN DATABASE_URL="postgresql://placeholder" npx prisma generate --schema packages/db/prisma/schema.prisma

# Compile TypeScript (turbo discovers all workspaces and builds in dependency order)
RUN npx turbo run build --filter=@spotterspace/api

# Prune devDependencies from production image
RUN npm prune --production --workspace=@spotterspace/api

# sharp requires platform-specific native binaries installed via postinstall,
# which --ignore-scripts skips. npm prune may also remove optionalDependencies.
# Explicitly install the correct Alpine native packages for the build architecture.
RUN SHARP_ARCH=$(uname -m | sed 's/aarch64/arm64/' | sed 's/x86_64/x64/') && \
    npm install --no-save --force \
      @img/sharp-linuxmusl-${SHARP_ARCH}@0.34.5 \
      @img/sharp-libvips-linuxmusl-${SHARP_ARCH}@1.2.4

# Reinstall prisma CLI (needed at runtime for migrate deploy in entrypoint)
# Pin to v6 to match project — v7 has breaking datasource config changes
RUN npm install prisma@^6.2.0 --no-save

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

WORKDIR /app

# Secrets are fetched by the Node.js app using @aws-sdk/client-secrets-manager
# No need for AWS CLI in the container

# Copy production node_modules and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./dist

# Copy prisma schema and migrations for migrate deploy
COPY --from=builder /app/packages/db/prisma ./prisma

# Set non-root user for App Runner
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001
USER nodeapp

COPY --from=builder /app/apps/api/docker-entrypoint.sh /docker-entrypoint.sh

ENV NODE_ENV=production
ENV API_PORT=4000

EXPOSE 4000

# Health check (start-period accounts for migration time on cold starts)
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["sh", "/docker-entrypoint.sh"]
