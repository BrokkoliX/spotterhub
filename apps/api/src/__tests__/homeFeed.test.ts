import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import {
  cleanDatabase,
  createTestContext,
  createTestUser,
  prisma,
  setupTestServer,
  teardownTestServer,
} from './testHelpers.js';

// Same S3/imageProcessing mocks as photo.test.ts so creating photos doesn't
// hit external services.
vi.mock('../services/s3.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getObject: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  };
});

let server: Awaited<ReturnType<typeof setupTestServer>>;

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

const PHOTOS_BY_AWARD = `
  query Photos($awardSlug: String) {
    photos(first: 20, awardSlug: $awardSlug) {
      totalCount
      edges {
        node {
          id
          caption
        }
      }
    }
  }
`;

const RANDOM_PHOTO = `
  query RandomPhoto {
    randomPhoto {
      id
      caption
    }
  }
`;

/**
 * Minimal photo factory: bypasses createPhoto and writes directly. The home
 * feed only cares about moderation_status, is_deleted, and a few sort keys,
 * so we don't need the full upload pipeline here.
 */
async function seedPhoto(userId: string, caption: string) {
  return prisma.photo.create({
    data: {
      userId,
      caption,
      originalUrl: `https://example.com/${caption}.jpg`,
      mimeType: 'image/jpeg',
      moderationStatus: 'approved',
    },
  });
}

describe('Photo: photos(awardSlug)', () => {
  it('returns only photos that have been awarded the named badge', async () => {
    const { user, ctx } = await createTestUser();
    const photoA = await seedPhoto(user.id, 'awarded');
    const photoB = await seedPhoto(user.id, 'not-awarded');

    // Define the badge and grant it to photoA only.
    const badge = await prisma.badgeDefinition.create({
      data: {
        slug: 'admin-choice-week',
        name: "Admin's Choice of the Week",
        description: 'x',
        category: 'AWARD',
        tier: 'GOLD',
        triggerType: 'AWARDED',
        isRepeatable: true,
        isActive: true,
      },
    });
    await prisma.userBadge.create({
      data: {
        userId: user.id,
        badgeDefinitionId: badge.id,
        awardedPhotoId: photoA.id,
      },
    });

    const res = await server.executeOperation(
      { query: PHOTOS_BY_AWARD, variables: { awardSlug: 'admin-choice-week' } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as {
      totalCount: number;
      edges: Array<{ node: { id: string; caption: string } }>;
    };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges).toHaveLength(1);
    expect(feed.edges[0].node.id).toBe(photoA.id);
    expect(feed.edges[0].node.caption).toBe('awarded');
    // Sanity: the un-awarded photo must not leak through.
    expect(feed.edges.find((e) => e.node.id === photoB.id)).toBeUndefined();
  });

  it('excludes badges that have been deactivated', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await seedPhoto(user.id, 'awarded-but-inactive');

    const badge = await prisma.badgeDefinition.create({
      data: {
        slug: 'admin-choice-week',
        name: "Admin's Choice of the Week",
        description: 'x',
        category: 'AWARD',
        tier: 'GOLD',
        triggerType: 'AWARDED',
        isActive: false, // deactivated
      },
    });
    await prisma.userBadge.create({
      data: { userId: user.id, badgeDefinitionId: badge.id, awardedPhotoId: photo.id },
    });

    const res = await server.executeOperation(
      { query: PHOTOS_BY_AWARD, variables: { awardSlug: 'admin-choice-week' } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    const feed = data.data?.photos as { totalCount: number };
    expect(feed.totalCount).toBe(0);
  });
});

describe('Photo: randomPhoto', () => {
  it('returns null when there are no approved photos', async () => {
    const ctx = createTestContext();
    const res = await server.executeOperation({ query: RANDOM_PHOTO }, { contextValue: ctx });
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.randomPhoto).toBeNull();
  });

  it('returns one of the approved, non-deleted photos', async () => {
    const { user } = await createTestUser();
    const p1 = await seedPhoto(user.id, 'approved-1');
    const p2 = await seedPhoto(user.id, 'approved-2');

    // A pending and a soft-deleted photo must never be picked.
    await prisma.photo.create({
      data: {
        userId: user.id,
        caption: 'pending',
        originalUrl: 'https://example.com/pending.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'pending',
      },
    });
    await prisma.photo.create({
      data: {
        userId: user.id,
        caption: 'deleted',
        originalUrl: 'https://example.com/deleted.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'approved',
        isDeleted: true,
      },
    });

    // Run a few times — we don't assert distribution (Math.random isn't
    // mockable here without more plumbing) but we do assert that every
    // returned id falls in the approved set.
    const approvedIds = new Set([p1.id, p2.id]);
    const ctx = createTestContext();
    for (let i = 0; i < 5; i++) {
      const res = await server.executeOperation({ query: RANDOM_PHOTO }, { contextValue: ctx });
      const data = (
        res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
      ).singleResult;
      expect(data.errors).toBeUndefined();
      const random = data.data?.randomPhoto as { id: string } | null;
      expect(random).not.toBeNull();
      expect(approvedIds.has(random!.id)).toBe(true);
    }
  });
});
