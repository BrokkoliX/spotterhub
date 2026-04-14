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
 * Get or create the singleton PrismaClient instance.
 * Uses a getter so the client is created lazily (after env vars are set).
 * In development, the client is stored on `globalThis` to survive hot reloads.
 */
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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
