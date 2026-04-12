import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import type { Context } from '../context.js';

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



async function createTestPhoto(userId: string, overrides: Partial<{
  caption: string;
  aircraftType: string;
  airline: string;
  airportCode: string;
  tags: string[];
}> = {}) {
  const photo = await prisma.photo.create({
    data: {
      userId,
      originalUrl: 'http://localhost:4566/test-bucket/test.jpg',
      mimeType: 'image/jpeg',
      moderationStatus: 'approved',
      caption: overrides.caption,
      aircraftTypeName: overrides.aircraftType ?? null,
      airline: overrides.airline,
      airportCode: overrides.airportCode,
    },
  });

  if (overrides.tags && overrides.tags.length > 0) {
    await prisma.photoTag.createMany({
      data: overrides.tags.map((tag) => ({ photoId: photo.id, tag })),
    });
  }

  return photo;
}

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const SEARCH_PHOTOS = `
  query SearchPhotos($query: String!, $first: Int, $after: String) {
    searchPhotos(query: $query, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          caption
          aircraftType
          airline
          airportCode
          tags
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

const SEARCH_USERS = `
  query SearchUsers($query: String!, $first: Int, $after: String) {
    searchUsers(query: $query, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          username
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('searchPhotos', () => {
  it('finds photos by caption', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { caption: 'Beautiful landing at sunset' });
    await createTestPhoto(user.id, { caption: 'Takeoff in the morning' });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'sunset' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(1);
    expect(data.searchPhotos.edges[0].node.caption).toContain('sunset');
  });

  it('finds photos by aircraft type (case-insensitive)', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { aircraftType: 'Boeing 747-400' });
    await createTestPhoto(user.id, { aircraftType: 'Airbus A380' });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'boeing' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(1);
    expect(data.searchPhotos.edges[0].node.aircraftType).toBe('Boeing 747-400');
  });

  it('finds photos by airline', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { airline: 'Delta Air Lines' });
    await createTestPhoto(user.id, { airline: 'United Airlines' });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'delta' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(1);
    expect(data.searchPhotos.edges[0].node.airline).toBe('Delta Air Lines');
  });

  it('finds photos by airport code', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { airportCode: 'KSEA' });
    await createTestPhoto(user.id, { airportCode: 'KLAX' });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'KSEA' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(1);
    expect(data.searchPhotos.edges[0].node.airportCode).toBe('KSEA');
  });

  it('finds photos by tag', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { caption: 'Photo 1', tags: ['military', 'fighter'] });
    await createTestPhoto(user.id, { caption: 'Photo 2', tags: ['commercial'] });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'military' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(1);
    expect(data.searchPhotos.edges[0].node.tags).toContain('military');
  });

  it('returns empty results for no match', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { caption: 'A photo' });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'zzzznonexistent' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(0);
    expect(data.searchPhotos.edges).toHaveLength(0);
  });

  it('returns empty results for empty query', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { caption: 'A photo' });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: '   ' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(0);
  });

  it('supports pagination', async () => {
    const { user } = await createTestUser();
    // Create 3 photos with matching caption
    for (let i = 0; i < 3; i++) {
      await createTestPhoto(user.id, { caption: `Boeing photo ${i}` });
    }

    const res1 = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'Boeing', first: 2 } },
      { contextValue: createTestContext() },
    );

    const data1 = (res1.body as any).singleResult.data;
    expect(data1.searchPhotos.edges).toHaveLength(2);
    expect(data1.searchPhotos.pageInfo.hasNextPage).toBe(true);
    expect(data1.searchPhotos.totalCount).toBe(3);

    // Page 2
    const res2 = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'Boeing', first: 2, after: data1.searchPhotos.pageInfo.endCursor } },
      { contextValue: createTestContext() },
    );

    const data2 = (res2.body as any).singleResult.data;
    expect(data2.searchPhotos.edges).toHaveLength(1);
    expect(data2.searchPhotos.pageInfo.hasNextPage).toBe(false);
  });

  it('excludes rejected photos', async () => {
    const { user } = await createTestUser();
    await createTestPhoto(user.id, { caption: 'Good Boeing shot' });
    // Create a rejected photo directly
    await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'http://localhost:4566/test-bucket/rejected.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'rejected',
        caption: 'Bad Boeing shot',
      },
    });

    const res = await server.executeOperation(
      { query: SEARCH_PHOTOS, variables: { query: 'Boeing' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchPhotos.totalCount).toBe(1);
    expect(data.searchPhotos.edges[0].node.caption).toBe('Good Boeing shot');
  });
});

describe('searchUsers', () => {
  it('finds users by username', async () => {
    await createTestUser({ username: 'avspotter', email: 'av@example.com', cognitoSub: 'sub-1' });
    await createTestUser({ username: 'planefan', email: 'pf@example.com', cognitoSub: 'sub-2' });

    const res = await server.executeOperation(
      { query: SEARCH_USERS, variables: { query: 'spotter' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchUsers.totalCount).toBe(1);
    expect(data.searchUsers.edges[0].node.username).toBe('avspotter');
  });

  it('finds users by display name', async () => {
    const { user } = await createTestUser({ username: 'jdoe', email: 'jd@example.com', cognitoSub: 'sub-dn' });
    await prisma.profile.create({
      data: { userId: user.id, displayName: 'John Doe Aviation' },
    });

    const res = await server.executeOperation(
      { query: SEARCH_USERS, variables: { query: 'Aviation' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchUsers.totalCount).toBe(1);
    expect(data.searchUsers.edges[0].node.username).toBe('jdoe');
  });

  it('is case-insensitive', async () => {
    await createTestUser({ username: 'PhotoPilot', email: 'pp@example.com', cognitoSub: 'sub-ci' });

    const res = await server.executeOperation(
      { query: SEARCH_USERS, variables: { query: 'photopilot' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchUsers.totalCount).toBe(1);
  });

  it('returns empty for no match', async () => {
    await createTestUser();

    const res = await server.executeOperation(
      { query: SEARCH_USERS, variables: { query: 'zzzznonexistent' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchUsers.totalCount).toBe(0);
    expect(data.searchUsers.edges).toHaveLength(0);
  });

  it('returns empty for blank query', async () => {
    await createTestUser();

    const res = await server.executeOperation(
      { query: SEARCH_USERS, variables: { query: '' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.searchUsers.totalCount).toBe(0);
  });
});
