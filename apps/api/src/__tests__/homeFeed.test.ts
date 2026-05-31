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

// ─── Community-context queries ──────────────────────────────────────────────

const PHOTOS_BY_COMMUNITY = `
  query Photos($communityIds: [ID!]) {
    photos(first: 20, communityIds: $communityIds) {
      totalCount
      edges {
        node { id caption community { id name slug } }
      }
    }
  }
`;

const COMMUNITIES_SORTED = `
  query Communities($sort: CommunitySort) {
    communities(first: 10, sort: $sort) {
      edges { node { id name slug } }
    }
  }
`;

const RECENT_THREADS = `
  query RecentForumThreads($first: Int) {
    recentForumThreads(first: $first) {
      id
      title
    }
  }
`;

async function seedCommunity(ownerId: string, name: string, slug: string) {
  return prisma.community.create({
    data: { name, slug, ownerId, visibility: 'public' },
  });
}

async function seedAlbumInCommunity(userId: string, communityId: string, title: string) {
  return prisma.album.create({
    data: { userId, communityId, title },
  });
}

async function seedPhotoInAlbum(userId: string, albumId: string, caption: string) {
  return prisma.photo.create({
    data: {
      userId,
      albumId,
      caption,
      originalUrl: `https://example.com/${caption}.jpg`,
      mimeType: 'image/jpeg',
      moderationStatus: 'approved',
    },
  });
}

describe('Photo: photos(communityIds) filter', () => {
  it('returns only photos whose album belongs to one of the given communities', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();

    const c1 = await seedCommunity(user.id, 'LAX Spotters', 'lax-spotters');
    const c2 = await seedCommunity(user.id, 'JFK Spotters', 'jfk-spotters');
    const albumC1 = await seedAlbumInCommunity(user.id, c1.id, 'LAX album');
    const albumC2 = await seedAlbumInCommunity(user.id, c2.id, 'JFK album');

    const p1 = await seedPhotoInAlbum(user.id, albumC1.id, 'lax-photo');
    await seedPhotoInAlbum(user.id, albumC2.id, 'jfk-photo');
    await seedPhoto(user.id, 'orphan-no-album'); // no album → must be excluded

    const res = await server.executeOperation(
      { query: PHOTOS_BY_COMMUNITY, variables: { communityIds: [c1.id] } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as {
      totalCount: number;
      edges: Array<{ node: { id: string; community: { id: string; slug: string } | null } }>;
    };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges).toHaveLength(1);
    expect(feed.edges[0].node.id).toBe(p1.id);
    expect(feed.edges[0].node.community?.slug).toBe('lax-spotters');
  });

  it('treats the filter as not-applied when communityIds is empty', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    await seedPhoto(user.id, 'p1');
    await seedPhoto(user.id, 'p2');

    const res = await server.executeOperation(
      { query: PHOTOS_BY_COMMUNITY, variables: { communityIds: [] } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as { totalCount: number };
    // Empty array means "no filter" — both approved photos returned, not zero.
    expect(feed.totalCount).toBe(2);
  });
});

describe('Photo: photos() excludes community photos from the general feed', () => {
  // Helper: seed a COMMUNITY-kind photo. We bypass createPhoto and write
  // directly because the home feed only cares about kind, moderation
  // status, and the album→community link.
  async function seedCommunityPhoto(userId: string, albumId: string, caption: string) {
    return prisma.photo.create({
      data: {
        userId,
        albumId,
        caption,
        originalUrl: `https://example.com/${caption}.jpg`,
        mimeType: 'image/jpeg',
        moderationStatus: 'approved',
        kind: 'COMMUNITY',
        communityCategory: 'SCENERY',
      },
    });
  }

  const PHOTOS_BASIC = `
    query Photos {
      photos(first: 20) {
        totalCount
        edges { node { id caption kind } }
      }
    }
  `;

  it('excludes COMMUNITY photos when no scoping args are provided', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const community = await seedCommunity(user.id, 'LAX', 'lax');
    const album = await seedAlbumInCommunity(user.id, community.id, 'LAX album');
    const aircraft = await seedPhoto(user.id, 'aircraft-1');
    await seedCommunityPhoto(user.id, album.id, 'community-1');

    const res = await server.executeOperation({ query: PHOTOS_BASIC }, { contextValue: ctx });
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as {
      totalCount: number;
      edges: Array<{ node: { id: string; kind: string } }>;
    };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges).toHaveLength(1);
    expect(feed.edges[0].node.id).toBe(aircraft.id);
    expect(feed.edges[0].node.kind).toBe('AIRCRAFT');
  });

  it('includes COMMUNITY photos when caller explicitly opts in via kind: COMMUNITY', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const community = await seedCommunity(user.id, 'JFK', 'jfk');
    const album = await seedAlbumInCommunity(user.id, community.id, 'JFK album');
    await seedPhoto(user.id, 'aircraft-1');
    const communityPhoto = await seedCommunityPhoto(user.id, album.id, 'community-1');

    const res = await server.executeOperation(
      {
        query: `query Photos { photos(first: 20, kind: COMMUNITY) { totalCount edges { node { id kind } } } }`,
      },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as {
      totalCount: number;
      edges: Array<{ node: { id: string; kind: string } }>;
    };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges[0].node.id).toBe(communityPhoto.id);
    expect(feed.edges[0].node.kind).toBe('COMMUNITY');
  });

  it('includes COMMUNITY photos in user-scoped queries (profile gallery)', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const community = await seedCommunity(user.id, 'SFO', 'sfo');
    const album = await seedAlbumInCommunity(user.id, community.id, 'SFO album');
    await seedPhoto(user.id, 'aircraft-1');
    await seedCommunityPhoto(user.id, album.id, 'community-1');

    const res = await server.executeOperation(
      {
        query: `query Photos($userId: ID!) { photos(first: 20, userId: $userId) { totalCount edges { node { kind } } } }`,
        variables: { userId: user.id },
      },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as {
      totalCount: number;
      edges: Array<{ node: { kind: string } }>;
    };
    expect(feed.totalCount).toBe(2);
    const kinds = feed.edges.map((e) => e.node.kind).sort();
    expect(kinds).toEqual(['AIRCRAFT', 'COMMUNITY']);
  });

  it('includes COMMUNITY photos in album-scoped queries', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const community = await seedCommunity(user.id, 'ORD', 'ord');
    const album = await seedAlbumInCommunity(user.id, community.id, 'ORD album');
    await seedPhoto(user.id, 'aircraft-orphan');
    await seedCommunityPhoto(user.id, album.id, 'community-1');

    const res = await server.executeOperation(
      {
        query: `query Photos($albumId: ID!) { photos(first: 20, albumId: $albumId) { totalCount edges { node { kind } } } }`,
        variables: { albumId: album.id },
      },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as {
      totalCount: number;
      edges: Array<{ node: { kind: string } }>;
    };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges[0].node.kind).toBe('COMMUNITY');
  });

  it('randomPhoto never returns COMMUNITY photos', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const community = await seedCommunity(user.id, 'SEA', 'sea');
    const album = await seedAlbumInCommunity(user.id, community.id, 'SEA album');
    const aircraft1 = await seedPhoto(user.id, 'aircraft-1');
    const aircraft2 = await seedPhoto(user.id, 'aircraft-2');
    await seedCommunityPhoto(user.id, album.id, 'community-1');
    await seedCommunityPhoto(user.id, album.id, 'community-2');

    const aircraftIds = new Set([aircraft1.id, aircraft2.id]);
    for (let i = 0; i < 8; i++) {
      const res = await server.executeOperation({ query: RANDOM_PHOTO }, { contextValue: ctx });
      const data = (
        res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
      ).singleResult;
      expect(data.errors).toBeUndefined();
      const random = data.data?.randomPhoto as { id: string } | null;
      expect(random).not.toBeNull();
      expect(aircraftIds.has(random!.id)).toBe(true);
    }
  });
});

describe('Photo: community field resolver', () => {
  it('returns the community of the photo album', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const community = await seedCommunity(user.id, 'Heathrow', 'egll');
    const album = await seedAlbumInCommunity(user.id, community.id, 'EGLL album');
    await seedPhotoInAlbum(user.id, album.id, 'p1');

    const res = await server.executeOperation(
      { query: PHOTOS_BY_COMMUNITY, variables: { communityIds: [community.id] } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    const feed = data.data?.photos as {
      edges: Array<{ node: { community: { name: string; slug: string } | null } }>;
    };
    expect(feed.edges[0].node.community).toEqual(
      expect.objectContaining({ name: 'Heathrow', slug: 'egll' }),
    );
  });

  it('returns null for a photo with no album', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    await seedPhoto(user.id, 'orphan');

    const res = await server.executeOperation(
      { query: `query { photos(first: 5) { edges { node { community { id } } } } }` },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.photos as { edges: Array<{ node: { community: unknown } }> };
    expect(feed.edges).toHaveLength(1);
    expect(feed.edges[0].node.community).toBeNull();
  });
});

describe('Query: communities(sort)', () => {
  it('orders by member count desc when sort = popular', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();

    const small = await seedCommunity(user.id, 'Small', 'small');
    const big = await seedCommunity(user.id, 'Big', 'big');
    const medium = await seedCommunity(user.id, 'Medium', 'medium');

    // Helper to add N active members to a community.
    async function addMembers(communityId: string, count: number) {
      for (let i = 0; i < count; i++) {
        const u = await prisma.user.create({
          data: {
            email: `m-${communityId}-${i}@test.com`,
            username: `m-${communityId.slice(0, 6)}-${i}`,
            cognitoSub: `m-${communityId}-${i}`,
          },
        });
        await prisma.communityMember.create({
          data: { communityId, userId: u.id, status: 'active', role: 'member' },
        });
      }
    }
    await addMembers(big.id, 5);
    await addMembers(medium.id, 2);
    await addMembers(small.id, 0);

    const res = await server.executeOperation(
      { query: COMMUNITIES_SORTED, variables: { sort: 'popular' } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const slugs = (
      data.data?.communities as { edges: Array<{ node: { slug: string } }> }
    ).edges.map((e) => e.node.slug);
    expect(slugs).toEqual(['big', 'medium', 'small']);
  });

  it('orders by createdAt desc when sort = recent (default)', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    await seedCommunity(user.id, 'First', 'first');
    // Force a tick so createdAt differs.
    await new Promise((r) => setTimeout(r, 10));
    await seedCommunity(user.id, 'Second', 'second');

    const res = await server.executeOperation(
      { query: COMMUNITIES_SORTED, variables: { sort: 'recent' } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    const slugs = (
      data.data?.communities as { edges: Array<{ node: { slug: string } }> }
    ).edges.map((e) => e.node.slug);
    expect(slugs).toEqual(['second', 'first']);
  });
});

describe('Query: recentForumThreads', () => {
  it('returns threads from any category, ordered by lastPostAt desc', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();

    // Two global categories, one per thread.
    const catA = await prisma.forumCategory.create({
      data: { name: 'A', slug: 'a', position: 0 },
    });
    const catB = await prisma.forumCategory.create({
      data: { name: 'B', slug: 'b', position: 1 },
    });
    const oldThread = await prisma.forumThread.create({
      data: {
        categoryId: catA.id,
        authorId: user.id,
        title: 'Old',
        lastPostAt: new Date(Date.now() - 60_000),
      },
    });
    const newThread = await prisma.forumThread.create({
      data: {
        categoryId: catB.id,
        authorId: user.id,
        title: 'New',
        lastPostAt: new Date(),
      },
    });

    const res = await server.executeOperation(
      { query: RECENT_THREADS, variables: { first: 5 } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    expect(data.errors).toBeUndefined();
    const threads = data.data?.recentForumThreads as Array<{ id: string; title: string }>;
    expect(threads.map((t) => t.id)).toEqual([newThread.id, oldThread.id]);
  });

  it('respects the first cap', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext();
    const cat = await prisma.forumCategory.create({
      data: { name: 'C', slug: 'c', position: 0 },
    });
    for (let i = 0; i < 4; i++) {
      await prisma.forumThread.create({
        data: {
          categoryId: cat.id,
          authorId: user.id,
          title: `T${i}`,
          lastPostAt: new Date(Date.now() + i * 1000),
        },
      });
    }

    const res = await server.executeOperation(
      { query: RECENT_THREADS, variables: { first: 2 } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    const threads = data.data?.recentForumThreads as Array<{ id: string }>;
    expect(threads).toHaveLength(2);
  });

  it('hides soft-deleted threads from non-privileged users', async () => {
    const { user } = await createTestUser();
    const ctx = createTestContext(); // anonymous viewer

    const cat = await prisma.forumCategory.create({
      data: { name: 'D', slug: 'd', position: 0 },
    });
    await prisma.forumThread.create({
      data: {
        categoryId: cat.id,
        authorId: user.id,
        title: 'visible',
        lastPostAt: new Date(),
      },
    });
    await prisma.forumThread.create({
      data: {
        categoryId: cat.id,
        authorId: user.id,
        title: 'hidden',
        isDeleted: true,
        lastPostAt: new Date(),
      },
    });

    const res = await server.executeOperation(
      { query: RECENT_THREADS, variables: { first: 5 } },
      { contextValue: ctx },
    );
    const data = (
      res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }
    ).singleResult;
    const threads = data.data?.recentForumThreads as Array<{ title: string }>;
    expect(threads.map((t) => t.title)).toEqual(['visible']);
  });
});
