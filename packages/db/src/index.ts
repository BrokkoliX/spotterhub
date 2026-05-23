/**
 * @module @spotterspace/db
 * Prisma client singleton for the SpotterSpace database.
 * All database access across the monorepo should use this exported client.
 *
 * In production (App Runner), DATABASE_URL is loaded from Secrets Manager
 * at runtime. The getter pattern ensures PrismaClient is not instantiated
 * until the env var is available.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Default connection pool tuning.
 *
 * Prisma's default `connection_limit` is `num_physical_cpus * 2 + 1`, which on
 * a 0.5-vCPU Fargate task evaluates to ~5. Combined with the default 10-second
 * `pool_timeout`, a single slow query (e.g. against a burstable RDS instance
 * with depleted CPU credits) can saturate the pool and cause every other
 * request to queue for 10s, then fail. Setting an explicit, higher pool size
 * with a generous timeout prevents that thundering herd.
 *
 * These can be overridden at runtime with PRISMA_CONNECTION_LIMIT and
 * PRISMA_POOL_TIMEOUT (seconds) so we can tune in production without a
 * redeploy.
 *
 * Note: Prisma honours `connection_limit` / `pool_timeout` only when supplied
 * as URL query params on `DATABASE_URL`. We inject them here unless the
 * operator has already set them on the URL itself.
 */
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

function withPoolingParams(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const limit = process.env.PRISMA_CONNECTION_LIMIT ?? String(DEFAULT_CONNECTION_LIMIT);
    const timeout = process.env.PRISMA_POOL_TIMEOUT ?? String(DEFAULT_POOL_TIMEOUT_SECONDS);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', limit);
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', timeout);
    }
    return url.toString();
  } catch {
    // Malformed URL — fall back to the raw value and let Prisma surface the
    // real error. Don't crash here just because we couldn't append params.
    return rawUrl;
  }
}

/**
 * Get or create the singleton PrismaClient instance.
 * Uses a getter so the client is created lazily (after env vars are set).
 * In development, the client is stored on `globalThis` to survive hot reloads.
 */
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const rawUrl = process.env.DATABASE_URL;
    const datasources = rawUrl ? { db: { url: withPoolingParams(rawUrl) } } : undefined;

    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      ...(datasources ? { datasources } : {}),
    });
  }
  return globalForPrisma.prisma;
}

/**
 * Singleton PrismaClient instance (lazy — created on first access).
 * Use this for all database operations.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export { PrismaClient };
export * from '@prisma/client';
