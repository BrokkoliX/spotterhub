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
      email: overrides.email ?? 'likeuser@example.com',
      username: overrides.username ?? 'likeuser',
      cognitoSub: overrides.cognitoSub ?? 'test-sub-like-1',
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

const LIKE_PHOTO = `
  mutation LikePhoto($photoId: ID!) {
    likePhoto(photoId: $photoId) {
      id
      likeCount
      isLikedByMe
    }
  }
`;

const UNLIKE_PHOTO = `
  mutation UnlikePhoto($photoId: ID!) {
    unlikePhoto(photoId: $photoId) {
      id
      likeCount
      isLikedByMe
    }
  }
`;

const GET_PHOTO = `
  query Photo($id: ID!) {
    photo(id: $id) {
      id
      likeCount
      isLikedByMe
    }
  }
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Like mutations', () => {
  describe('likePhoto', () => {
    it('should like a photo successfully', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const res = await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      expect(res.body.kind).toBe('single');
      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.likePhoto).toMatchObject({
        id: photo.id,
        likeCount: 1,
        isLikedByMe: true,
      });
    });

    it('should be idempotent — liking an already liked photo is a no-op', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      // Like once
      await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      // Like again
      const res = await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.likePhoto).toMatchObject({
        id: photo.id,
        likeCount: 1,
        isLikedByMe: true,
      });
    });

    it('should fail when not authenticated', async () => {
      const { user } = await createTestUser();
      const photo = await createTestPhoto(user.id);
      const ctx = createTestContext(null);

      const res = await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('should fail when photo does not exist', async () => {
      const { ctx } = await createTestUser();

      const res = await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: '00000000-0000-0000-0000-000000000000' } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('unlikePhoto', () => {
    it('should unlike a liked photo successfully', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      // Like first
      await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      // Unlike
      const res = await server.executeOperation(
        { query: UNLIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.unlikePhoto).toMatchObject({
        id: photo.id,
        likeCount: 0,
        isLikedByMe: false,
      });
    });

    it('should be idempotent — unliking a photo not liked is a no-op', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const res = await server.executeOperation(
        { query: UNLIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.unlikePhoto).toMatchObject({
        id: photo.id,
        likeCount: 0,
        isLikedByMe: false,
      });
    });

    it('should fail when not authenticated', async () => {
      const { user } = await createTestUser();
      const photo = await createTestPhoto(user.id);
      const ctx = createTestContext(null);

      const res = await server.executeOperation(
        { query: UNLIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });
  });
});

describe('isLikedByMe field resolver', () => {
  it('should return true when user has liked the photo', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    // Like the photo
    await server.executeOperation(
      { query: LIKE_PHOTO, variables: { photoId: photo.id } },
      { contextValue: ctx },
    );

    // Query the photo
    const res = await server.executeOperation(
      { query: GET_PHOTO, variables: { id: photo.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.photo as Record<string, unknown>)?.isLikedByMe).toBe(true);
  });

  it('should return false when user has not liked the photo', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    const res = await server.executeOperation(
      { query: GET_PHOTO, variables: { id: photo.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.photo as Record<string, unknown>)?.isLikedByMe).toBe(false);
  });

  it('should return false when not authenticated', async () => {
    const { user } = await createTestUser();
    const photo = await createTestPhoto(user.id);
    const ctx = createTestContext(null);

    const res = await server.executeOperation(
      { query: GET_PHOTO, variables: { id: photo.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.photo as Record<string, unknown>)?.isLikedByMe).toBe(false);
  });
});
