import { ApolloServer } from '@apollo/server';
import { Prisma, prisma } from '@spotterspace/db';

import type { Context } from '../context.js';
import { createLoaders } from '../loaders.js';
import { resolvers } from '../resolvers.js';
import { typeDefs } from '../schema.js';

// ─── Server lifecycle ─────────────────────────────────────────────────────────

export async function setupTestServer(): Promise<ApolloServer<Context>> {
  const server = new ApolloServer<Context>({ typeDefs, resolvers });
  await server.start();
  return server;
}

export async function teardownTestServer(server: ApolloServer<Context>): Promise<void> {
  await server.stop();
  await prisma.$disconnect();
}

// ─── Context helpers ──────────────────────────────────────────────────────────

// Minimal mock for ServerResponse with setHeader
const mockRes = {
  setHeader: (_name: string, _value: string | string[]) => {
    // no-op in tests
  },
  getHeader: () => undefined,
  removeHeader: () => {},
  statusCode: 200,
  statusMessage: '',
  end: () => {},
  write: () => false,
  once: () => {},
  addListener: () => {},
  emit: () => false,
  on: () => {},
  appendHeader: () => mockRes as unknown as import('node:http').ServerResponse,
  flushHeaders: () => mockRes as unknown as import('node:http').ServerResponse,
} as unknown as import('node:http').ServerResponse;

export function createTestContext(user: Context['user'] = null): Context {
  return { prisma, user, loaders: createLoaders(prisma), res: mockRes, req: {} as Context['req'] };
}

export async function createTestUser(
  overrides: Partial<{
    email: string;
    username: string;
    cognitoSub: string;
    role: 'user' | 'moderator' | 'admin' | 'superuser';
  }> = {},
) {
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? 'test@example.com',
      username: overrides.username ?? 'testuser',
      cognitoSub: overrides.cognitoSub ?? 'test-sub-1',
      ...(overrides.role !== undefined && { role: overrides.role }),
    },
  });
  const ctx = createTestContext({
    sub: user.cognitoSub,
    email: user.email,
    username: user.username,
  });
  return { user, ctx };
}

// ─── Database cleanup ─────────────────────────────────────────────────────────

/**
 * Cached list of fully-qualified table names (schema.tableName) derived from
 * the Prisma DMMF datamodel. Computed once on first call and reused.
 */
let cachedTableList: string | null = null;

/**
 * Build a comma-separated list of quoted table identifiers from the Prisma
 * DMMF. Falls back to the model name when no `@@map` is set, which mirrors
 * Prisma's own table-naming convention.
 */
function getTableList(): string {
  if (cachedTableList) return cachedTableList;
  const tables = Prisma.dmmf.datamodel.models
    .map((model) => model.dbName ?? model.name)
    .map((name) => `"public"."${name}"`);
  cachedTableList = tables.join(', ');
  return cachedTableList;
}

/**
 * Truncates every table managed by Prisma in a single statement. Uses
 * `TRUNCATE ... RESTART IDENTITY CASCADE` so FK ordering is handled by
 * Postgres rather than hand-maintained, and sequence values reset between
 * tests for deterministic IDs where applicable.
 *
 * Replaces the previous hand-maintained delete-list which was fragile to
 * schema drift — any new model in `schema.prisma` would silently leak rows
 * across test cases until somebody remembered to add a `deleteMany` call.
 */
export async function cleanDatabase(): Promise<void> {
  const tables = getTableList();
  if (!tables) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}

export { prisma };
