import { ApolloServer } from '@apollo/server';
import { prisma } from '@spotterspace/db';

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
  overrides: Partial<{ email: string; username: string; cognitoSub: string }> = {},
) {
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? 'test@example.com',
      username: overrides.username ?? 'testuser',
      cognitoSub: overrides.cognitoSub ?? 'test-sub-1',
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
 * Deletes all data from all tables in the correct dependency order.
 * Uses a single function so FK ordering is maintained in one place.
 */
export async function cleanDatabase(): Promise<void> {
  await prisma.eventAttendee.deleteMany();
  await prisma.communityEvent.deleteMany();
  await prisma.forumPost.deleteMany();
  await prisma.forumThread.deleteMany();
  await prisma.forumCategory.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.communitySubscription.deleteMany();
  await prisma.community.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.photoTag.deleteMany();
  await prisma.photoLocation.deleteMany();
  await prisma.photoVariant.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.album.deleteMany();
  await prisma.spottingLocation.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.airport.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export { prisma };
