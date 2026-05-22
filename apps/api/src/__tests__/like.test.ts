import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  createTestUser,
  cleanDatabase,
  createTestContext,
  prisma,
  setupTestServer,
  teardownTestServer,
} from './testHelpers.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

let server: Awaited<ReturnType<typeof setupTestServer>>;

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
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

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
      const data = (
        res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
      ).singleResult;
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

      const data = (
        res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
      ).singleResult;
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

      const data = (
        res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }
      ).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('should fail when photo does not exist', async () => {
      const { ctx } = await createTestUser();

      const res = await server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: '00000000-0000-0000-0000-000000000000' } },
        { contextValue: ctx },
      );

      const data = (
        res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }
      ).singleResult;
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

      const data = (
        res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
      ).singleResult;
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

      const data = (
        res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
      ).singleResult;
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

      const data = (
        res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }
      ).singleResult;
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

// ─── Race-condition regression test ──────────────────────────────────────────
//
// Sprint 2 (S2.1) wrapped likePhoto/unlikePhoto in a Prisma $transaction so
// concurrent calls from the same user cannot double-increment the
// denormalised likeCount. Without the transaction, two parallel likePhoto
// calls could each observe `existing == null` and both call `create` +
// increment, leaving likeCount at 2. With the fix, exactly one Like row is
// created and likeCount stays at 1 regardless of how many parallel calls
// arrive.
describe('Like mutations: race-condition regression', () => {
  it('concurrent likePhoto calls produce exactly one like and likeCount === 1', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    // Fire two likePhoto operations in parallel. Either one wins (or both
    // observe the upsert path) — the post-condition is the same.
    await Promise.allSettled([
      server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      ),
      server.executeOperation(
        { query: LIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      ),
    ]);

    // Assert the persisted state directly rather than via the resolver
    // response, since one of the two responses may legitimately have
    // observed the partially-committed state mid-transaction.
    const likeCount = await prisma.like.count({
      where: { userId: user.id, photoId: photo.id },
    });
    expect(likeCount).toBe(1);

    const photoRow = await prisma.photo.findUnique({
      where: { id: photo.id },
      select: { likeCount: true },
    });
    expect(photoRow?.likeCount).toBe(1);
  });

  it('concurrent unlikePhoto calls leave likeCount at 0 and no like rows', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    // Pre-condition: photo is liked
    await server.executeOperation(
      { query: LIKE_PHOTO, variables: { photoId: photo.id } },
      { contextValue: ctx },
    );

    await Promise.allSettled([
      server.executeOperation(
        { query: UNLIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      ),
      server.executeOperation(
        { query: UNLIKE_PHOTO, variables: { photoId: photo.id } },
        { contextValue: ctx },
      ),
    ]);

    const likeCount = await prisma.like.count({
      where: { userId: user.id, photoId: photo.id },
    });
    expect(likeCount).toBe(0);

    const photoRow = await prisma.photo.findUnique({
      where: { id: photo.id },
      select: { likeCount: true },
    });
    expect(photoRow?.likeCount).toBe(0);
  });
});
