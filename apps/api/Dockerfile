# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files and configs
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY turbo.json ./

# Copy workspace package files
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma/
COPY packages/shared/package.json ./packages/shared/

# Copy app source
COPY apps/api ./apps/api

# Install all dependencies
RUN npm install

# Generate Prisma client
RUN DATABASE_URL="postgresql://placeholder" npx prisma generate --schema packages/db/prisma/schema.prisma

# Compile TypeScript
RUN npm run build --workspace=@spotterhub/api

# Prune devDependencies
RUN npm prune --production --workspace=@spotterhub/api

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install AWS CLI (for secrets fetching) and gzip
RUN apk add --no-cache aws-cli gzip

# Copy production node_modules and built output from builder
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

COPY --from=builder /app/apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
