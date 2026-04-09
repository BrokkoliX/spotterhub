import { ApolloServer } from '@apollo/server';
import { prisma } from '@spotterhub/db';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import type { Context } from '../context.js';
import { resolvers } from '../resolvers.js';
import { typeDefs } from '../schema.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

let server: ApolloServer<Context>;

function createTestContext(user: Context['user'] = null): Context {
  return { prisma, user };
}

async function createTestUser(overrides: Partial<{ email: string; username: string; cognitoSub: string }> = {}) {
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? 'reportuser@example.com',
      username: overrides.username ?? 'reportuser',
      cognitoSub: overrides.cognitoSub ?? 'test-sub-report-1',
    },
  });
  const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });
  return { user, ctx };
}

async function createTestPhoto(userId: string) {
  return prisma.photo.create({
    data: {
      userId,
      originalUrl: 'http://localhost:4566/test-bucket/test.jpg',
      mimeType: 'image/jpeg',
      moderationStatus: 'approved',
    },
  });
}

beforeAll(async () => {
  server = new ApolloServer<Context>({ typeDefs, resolvers });
  await server.start();
});

afterAll(async () => {
  await server.stop();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.photoTag.deleteMany();
  await prisma.photoLocation.deleteMany();
  await prisma.photoVariant.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.album.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.communitySubscription.deleteMany();
  await prisma.community.deleteMany();
  await prisma.spottingLocation.deleteMany();
  await prisma.user.deleteMany();
});

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const CREATE_REPORT = `
  mutation CreateReport($input: CreateReportInput!) {
    createReport(input: $input) {
      id
      targetType
      targetId
      reason
      description
      status
    }
  }
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createReport mutation', () => {
  it('should create a report for a photo', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'photo', targetId: photo.id, reason: 'spam' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const report = data.data?.createReport as Record<string, unknown>;
    expect(report?.targetType).toBe('photo');
    expect(report?.targetId).toBe(photo.id);
    expect(report?.reason).toBe('spam');
    expect(report?.status).toBe('open');
  });

  it('should create a report for a comment', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);
    const comment = await prisma.comment.create({
      data: { userId: user.id, photoId: photo.id, body: 'Test comment' },
    });

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'comment', targetId: comment.id, reason: 'harassment' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const report = data.data?.createReport as Record<string, unknown>;
    expect(report?.targetType).toBe('comment');
    expect(report?.reason).toBe('harassment');
  });

  it('should create a report with description for "other" reason', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: {
            targetType: 'photo',
            targetId: photo.id,
            reason: 'other',
            description: 'This photo is misleading',
          },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const report = data.data?.createReport as Record<string, unknown>;
    expect(report?.reason).toBe('other');
    expect(report?.description).toBe('This photo is misleading');
  });

  it('should fail with invalid target type', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'invalid', targetId: 'some-id', reason: 'spam' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should fail with invalid reason', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'photo', targetId: photo.id, reason: 'invalid-reason' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should fail when "other" reason has no description', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'photo', targetId: photo.id, reason: 'other' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should fail when target does not exist', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: {
            targetType: 'photo',
            targetId: '00000000-0000-0000-0000-000000000000',
            reason: 'spam',
          },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('should prevent duplicate reports from same user', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    // First report succeeds
    await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'photo', targetId: photo.id, reason: 'spam' },
        },
      },
      { contextValue: ctx },
    );

    // Second report fails
    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'photo', targetId: photo.id, reason: 'inappropriate' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should fail when not authenticated', async () => {
    const { user } = await createTestUser();
    const photo = await createTestPhoto(user.id);
    const ctx = createTestContext(null);

    const res = await server.executeOperation(
      {
        query: CREATE_REPORT,
        variables: {
          input: { targetType: 'photo', targetId: photo.id, reason: 'spam' },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
