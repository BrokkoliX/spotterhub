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



beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const CREATE_PHOTO = `
  mutation CreatePhoto($input: CreatePhotoInput!) {
    createPhoto(input: $input) {
      id
      caption
      aircraftType
      airline
      airportCode
      originalUrl
      moderationStatus
      tags
      user { id username }
      variants { id variantType url width height }
      likeCount
      commentCount
    }
  }
`;

const UPDATE_PHOTO = `
  mutation UpdatePhoto($id: ID!, $input: UpdatePhotoInput!) {
    updatePhoto(id: $id, input: $input) {
      id
      caption
      aircraftType
      airline
      airportCode
      tags
    }
  }
`;

const DELETE_PHOTO = `
  mutation DeletePhoto($id: ID!) {
    deletePhoto(id: $id)
  }
`;

const GET_PHOTO = `
  query Photo($id: ID!) {
    photo(id: $id) {
      id
      caption
      aircraftType
      moderationStatus
      tags
      user { id username }
      variants { variantType }
      likeCount
      commentCount
    }
  }
`;

const GET_PHOTOS = `
  query Photos($first: Int, $after: String, $userId: ID, $aircraftType: String, $airportCode: String, $tags: [String!]) {
    photos(first: $first, after: $after, userId: $userId, aircraftType: $aircraftType, airportCode: $airportCode, tags: $tags) {
      edges {
        cursor
        node {
          id
          caption
          aircraftType
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

const GET_UPLOAD_URL = `
  mutation GetUploadUrl($input: GetUploadUrlInput!) {
    getUploadUrl(input: $input) {
      url
      key
    }
  }
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Photo: createPhoto', () => {
  it('creates a photo record with metadata and tags', async () => {
    const { ctx } = await createTestUser();

    const result = await server.executeOperation(
      {
        query: CREATE_PHOTO,
        variables: {
          input: {
            s3Key: 'uploads/test-user/test-photo.jpg',
            mimeType: 'image/jpeg',
            fileSizeBytes: 1024000,
            caption: 'Beautiful 747 on approach',
            aircraftType: 'Boeing 747-8',
            airline: 'Lufthansa',
            airportCode: 'KSFO',
            tags: ['747', 'approach', 'sunset'],
          },
        },
      },
      { contextValue: ctx },
    );

    expect(result.body.kind).toBe('single');
    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;

    // Variant generation may fail without real S3/LocalStack, so we accept either
    // a successful photo or a photo with empty variants
    expect(data.errors).toBeUndefined();
    const photo = data.data?.createPhoto as Record<string, unknown>;
    expect(photo).toBeDefined();
    expect(photo.caption).toBe('Beautiful 747 on approach');
    expect(photo.aircraftType).toBe('Boeing 747-8');
    expect(photo.airline).toBe('Lufthansa');
    expect(photo.airportCode).toBe('KSFO');
    expect(photo.moderationStatus).toBe('approved');
    expect(photo.tags).toEqual(expect.arrayContaining(['747', 'approach', 'sunset']));
    expect(photo.likeCount).toBe(0);
    expect(photo.commentCount).toBe(0);
  });

  it('rejects unauthenticated users', async () => {
    const result = await server.executeOperation(
      {
        query: CREATE_PHOTO,
        variables: {
          input: {
            s3Key: 'uploads/test/photo.jpg',
            mimeType: 'image/jpeg',
            fileSizeBytes: 1024,
          },
        },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { errors?: Array<{ message: string; extensions?: { code: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
  });
});

describe('Photo: updatePhoto', () => {
  it('allows the owner to update their photo', async () => {
    const { user, ctx } = await createTestUser();

    // Create a photo directly
    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'https://example.com/photo.jpg',
        moderationStatus: 'approved',
      },
    });

    const result = await server.executeOperation(
      {
        query: UPDATE_PHOTO,
        variables: {
          id: photo.id,
          input: {
            caption: 'Updated caption',
            aircraftType: 'Airbus A380',
            airline: 'Emirates',
            airportCode: 'KJFK',
            tags: ['a380', 'jumbo'],
          },
        },
      },
      { contextValue: ctx },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const updated = data.data?.updatePhoto as Record<string, unknown>;
    expect(updated.caption).toBe('Updated caption');
    expect(updated.aircraftType).toBe('Airbus A380');
    expect(updated.airline).toBe('Emirates');
    expect(updated.tags).toEqual(expect.arrayContaining(['a380', 'jumbo']));
  });

  it('prevents non-owners from updating a photo', async () => {
    const { user } = await createTestUser({ email: 'owner@test.com', username: 'owner', cognitoSub: 'sub-owner' });
    const { ctx: otherCtx } = await createTestUser({ email: 'other@test.com', username: 'other', cognitoSub: 'sub-other' });

    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'https://example.com/photo.jpg',
        moderationStatus: 'approved',
      },
    });

    const result = await server.executeOperation(
      {
        query: UPDATE_PHOTO,
        variables: { id: photo.id, input: { caption: 'Hacked!' } },
      },
      { contextValue: otherCtx },
    );

    const data = (result.body as { kind: 'single'; singleResult: { errors?: Array<{ extensions?: { code: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors![0].extensions?.code).toBe('FORBIDDEN');
  });
});

describe('Photo: deletePhoto', () => {
  it('allows the owner to delete their photo', async () => {
    const { user, ctx } = await createTestUser();

    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'https://example.com/photo.jpg',
        moderationStatus: 'approved',
      },
    });

    const result = await server.executeOperation(
      {
        query: DELETE_PHOTO,
        variables: { id: photo.id },
      },
      { contextValue: ctx },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.deletePhoto).toBe(true);

    // Verify it's actually deleted
    const deleted = await prisma.photo.findUnique({ where: { id: photo.id } });
    expect(deleted).toBeNull();
  });

  it('returns NOT_FOUND for non-existent photo', async () => {
    const { ctx } = await createTestUser();

    const result = await server.executeOperation(
      {
        query: DELETE_PHOTO,
        variables: { id: '00000000-0000-0000-0000-000000000000' },
      },
      { contextValue: ctx },
    );

    const data = (result.body as { kind: 'single'; singleResult: { errors?: Array<{ extensions?: { code: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors![0].extensions?.code).toBe('NOT_FOUND');
  });
});

describe('Photo: photo query', () => {
  it('fetches a single photo by ID', async () => {
    const { user } = await createTestUser();

    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'https://example.com/photo.jpg',
        caption: 'A sunny day at the airport',
        aircraftType: 'Boeing 737-800',
        moderationStatus: 'approved',
        tags: { create: [{ tag: 'boeing' }, { tag: '737' }] },
      },
    });

    const result = await server.executeOperation(
      {
        query: GET_PHOTO,
        variables: { id: photo.id },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const fetched = data.data?.photo as Record<string, unknown>;
    expect(fetched).toBeDefined();
    expect(fetched.caption).toBe('A sunny day at the airport');
    expect(fetched.aircraftType).toBe('Boeing 737-800');
    expect(fetched.tags).toEqual(expect.arrayContaining(['boeing', '737']));
  });

  it('returns null for non-existent photo', async () => {
    const result = await server.executeOperation(
      {
        query: GET_PHOTO,
        variables: { id: '00000000-0000-0000-0000-000000000000' },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.photo).toBeNull();
  });
});

describe('Photo: photos feed with pagination and filtering', () => {
  it('returns paginated results with cursor-based pagination', async () => {
    const { user } = await createTestUser();

    // Create 5 photos with staggered timestamps
    const photos = [];
    for (let i = 0; i < 5; i++) {
      const photo = await prisma.photo.create({
        data: {
          userId: user.id,
          originalUrl: `https://example.com/photo-${i}.jpg`,
          caption: `Photo ${i}`,
          moderationStatus: 'approved',
          createdAt: new Date(Date.now() - i * 60000), // 1 min apart
        },
      });
      photos.push(photo);
    }

    // First page: 2 items
    const page1 = await server.executeOperation(
      {
        query: GET_PHOTOS,
        variables: { first: 2 },
      },
      { contextValue: createTestContext(null) },
    );

    const page1Data = (page1.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult;
    const page1Photos = page1Data.data?.photos as {
      edges: Array<{ cursor: string; node: { id: string; caption: string } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
      totalCount: number;
    };

    expect(page1Photos.edges).toHaveLength(2);
    expect(page1Photos.totalCount).toBe(5);
    expect(page1Photos.pageInfo.hasNextPage).toBe(true);
    expect(page1Photos.edges[0].node.caption).toBe('Photo 0'); // newest first

    // Second page using cursor
    const page2 = await server.executeOperation(
      {
        query: GET_PHOTOS,
        variables: { first: 2, after: page1Photos.pageInfo.endCursor },
      },
      { contextValue: createTestContext(null) },
    );

    const page2Data = (page2.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult;
    const page2Photos = page2Data.data?.photos as {
      edges: Array<{ node: { caption: string } }>;
      pageInfo: { hasNextPage: boolean };
    };

    expect(page2Photos.edges).toHaveLength(2);
    expect(page2Photos.pageInfo.hasNextPage).toBe(true);
  });

  it('filters photos by aircraftType', async () => {
    const { user } = await createTestUser();

    await prisma.photo.createMany({
      data: [
        { userId: user.id, originalUrl: 'https://example.com/1.jpg', aircraftType: 'Boeing 747-8', moderationStatus: 'approved' },
        { userId: user.id, originalUrl: 'https://example.com/2.jpg', aircraftType: 'Airbus A380', moderationStatus: 'approved' },
        { userId: user.id, originalUrl: 'https://example.com/3.jpg', aircraftType: 'Boeing 737 MAX', moderationStatus: 'approved' },
      ],
    });

    const result = await server.executeOperation(
      {
        query: GET_PHOTOS,
        variables: { aircraftType: 'Boeing' },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult;
    const photos = data.data?.photos as { edges: Array<{ node: { aircraftType: string } }>; totalCount: number };

    expect(photos.totalCount).toBe(2);
    photos.edges.forEach((edge) => {
      expect(edge.node.aircraftType).toContain('Boeing');
    });
  });

  it('filters photos by airportCode', async () => {
    const { user } = await createTestUser();

    await prisma.photo.createMany({
      data: [
        { userId: user.id, originalUrl: 'https://example.com/1.jpg', airportCode: 'KSFO', moderationStatus: 'approved' },
        { userId: user.id, originalUrl: 'https://example.com/2.jpg', airportCode: 'KLAX', moderationStatus: 'approved' },
        { userId: user.id, originalUrl: 'https://example.com/3.jpg', airportCode: 'KSFO', moderationStatus: 'approved' },
      ],
    });

    const result = await server.executeOperation(
      {
        query: GET_PHOTOS,
        variables: { airportCode: 'KSFO' },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult;
    const photos = data.data?.photos as { totalCount: number };
    expect(photos.totalCount).toBe(2);
  });

  it('filters photos by tags', async () => {
    const { user } = await createTestUser();

    const photo1 = await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'https://example.com/1.jpg',
        moderationStatus: 'approved',
        tags: { create: [{ tag: 'sunset' }, { tag: 'landing' }] },
      },
    });

    await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'https://example.com/2.jpg',
        moderationStatus: 'approved',
        tags: { create: [{ tag: 'takeoff' }] },
      },
    });

    const result = await server.executeOperation(
      {
        query: GET_PHOTOS,
        variables: { tags: ['sunset'] },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult;
    const photos = data.data?.photos as { totalCount: number; edges: Array<{ node: { id: string } }> };
    expect(photos.totalCount).toBe(1);
    expect(photos.edges[0].node.id).toBe(photo1.id);
  });

  it('filters photos by userId', async () => {
    const { user: user1 } = await createTestUser({ email: 'user1@test.com', username: 'user1', cognitoSub: 'sub-1' });
    const { user: user2 } = await createTestUser({ email: 'user2@test.com', username: 'user2', cognitoSub: 'sub-2' });

    await prisma.photo.createMany({
      data: [
        { userId: user1.id, originalUrl: 'https://example.com/1.jpg', moderationStatus: 'approved' },
        { userId: user1.id, originalUrl: 'https://example.com/2.jpg', moderationStatus: 'approved' },
        { userId: user2.id, originalUrl: 'https://example.com/3.jpg', moderationStatus: 'approved' },
      ],
    });

    const result = await server.executeOperation(
      {
        query: GET_PHOTOS,
        variables: { userId: user1.id },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult;
    const photos = data.data?.photos as { totalCount: number };
    expect(photos.totalCount).toBe(2);
  });
});

describe('Photo: getUploadUrl', () => {
  it('rejects unauthenticated requests', async () => {
    const result = await server.executeOperation(
      {
        query: GET_UPLOAD_URL,
        variables: { input: { mimeType: 'image/jpeg', fileSizeBytes: 1024 } },
      },
      { contextValue: createTestContext(null) },
    );

    const data = (result.body as { kind: 'single'; singleResult: { errors?: Array<{ extensions?: { code: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid MIME types', async () => {
    const { ctx } = await createTestUser();

    const result = await server.executeOperation(
      {
        query: GET_UPLOAD_URL,
        variables: { input: { mimeType: 'application/pdf', fileSizeBytes: 1024 } },
      },
      { contextValue: ctx },
    );

    const data = (result.body as { kind: 'single'; singleResult: { errors?: Array<{ extensions?: { code: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors![0].extensions?.code).toBe('BAD_USER_INPUT');
  });
});
