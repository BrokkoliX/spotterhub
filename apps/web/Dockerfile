# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy workspace package files
COPY packages/shared/package.json ./packages/shared/

# Copy app source
COPY apps/web ./apps/web

# Install dependencies
RUN npm ci --workspaces=false

# Build Next.js standalone output
RUN npm run build --workspace=@spotterhub/web

# Prune devDependencies
RUN npm prune --production --workspace=@spotterhub/web

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install gzip for compression
RUN apk add --no-cache gzip

# Copy Next.js standalone output + static assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
