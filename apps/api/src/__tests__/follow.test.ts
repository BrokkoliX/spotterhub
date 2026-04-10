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

const FOLLOW_USER = `
  mutation FollowUser($userId: ID!) {
    followUser(userId: $userId) {
      id
      username
      followerCount
      isFollowedByMe
    }
  }
`;

const UNFOLLOW_USER = `
  mutation UnfollowUser($userId: ID!) {
    unfollowUser(userId: $userId) {
      id
      username
      followerCount
      isFollowedByMe
    }
  }
`;

const GET_USER = `
  query User($username: String!) {
    user(username: $username) {
      id
      username
      followerCount
      followingCount
      isFollowedByMe
    }
  }
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Follow mutations', () => {
  describe('followUser', () => {
    it('should follow a user successfully', async () => {
      const { ctx } = await createTestUser();
      const { user: targetUser } = await createTestUser({
        email: 'target@example.com',
        username: 'targetuser',
        cognitoSub: 'test-sub-follow-2',
      });

      const res = await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      expect(res.body.kind).toBe('single');
      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.followUser).toMatchObject({
        id: targetUser.id,
        followerCount: 1,
        isFollowedByMe: true,
      });
    });

    it('should be idempotent — following an already followed user is a no-op', async () => {
      const { ctx } = await createTestUser();
      const { user: targetUser } = await createTestUser({
        email: 'target@example.com',
        username: 'targetuser',
        cognitoSub: 'test-sub-follow-2',
      });

      // Follow once
      await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      // Follow again
      const res = await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.followUser).toMatchObject({
        id: targetUser.id,
        followerCount: 1,
        isFollowedByMe: true,
      });
    });

    it('should fail when trying to follow yourself', async () => {
      const { user, ctx } = await createTestUser();

      const res = await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: user.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    });

    it('should fail when not authenticated', async () => {
      const { user: targetUser } = await createTestUser();
      const ctx = createTestContext(null);

      const res = await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('should fail when target user does not exist', async () => {
      const { ctx } = await createTestUser();

      const res = await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: '00000000-0000-0000-0000-000000000000' } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow a followed user successfully', async () => {
      const { ctx } = await createTestUser();
      const { user: targetUser } = await createTestUser({
        email: 'target@example.com',
        username: 'targetuser',
        cognitoSub: 'test-sub-follow-2',
      });

      // Follow first
      await server.executeOperation(
        { query: FOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      // Unfollow
      const res = await server.executeOperation(
        { query: UNFOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.unfollowUser).toMatchObject({
        id: targetUser.id,
        followerCount: 0,
        isFollowedByMe: false,
      });
    });

    it('should be idempotent — unfollowing a user not followed is a no-op', async () => {
      const { ctx } = await createTestUser();
      const { user: targetUser } = await createTestUser({
        email: 'target@example.com',
        username: 'targetuser',
        cognitoSub: 'test-sub-follow-2',
      });

      const res = await server.executeOperation(
        { query: UNFOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.unfollowUser).toMatchObject({
        id: targetUser.id,
        followerCount: 0,
        isFollowedByMe: false,
      });
    });

    it('should fail when not authenticated', async () => {
      const { user: targetUser } = await createTestUser();
      const ctx = createTestContext(null);

      const res = await server.executeOperation(
        { query: UNFOLLOW_USER, variables: { userId: targetUser.id } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });
  });
});

describe('isFollowedByMe field resolver', () => {
  it('should return true when user follows the target', async () => {
    const { ctx } = await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target@example.com',
      username: 'targetuser',
      cognitoSub: 'test-sub-follow-2',
    });

    // Follow the target
    await server.executeOperation(
      { query: FOLLOW_USER, variables: { userId: targetUser.id } },
      { contextValue: ctx },
    );

    // Query the target user
    const res = await server.executeOperation(
      { query: GET_USER, variables: { username: targetUser.username } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.user as Record<string, unknown>)?.isFollowedByMe).toBe(true);
  });

  it('should return false when user does not follow the target', async () => {
    const { ctx } = await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target@example.com',
      username: 'targetuser',
      cognitoSub: 'test-sub-follow-2',
    });

    const res = await server.executeOperation(
      { query: GET_USER, variables: { username: targetUser.username } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.user as Record<string, unknown>)?.isFollowedByMe).toBe(false);
  });

  it('should return false when not authenticated', async () => {
    await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target@example.com',
      username: 'targetuser',
      cognitoSub: 'test-sub-follow-2',
    });
    const ctx = createTestContext(null);

    const res = await server.executeOperation(
      { query: GET_USER, variables: { username: targetUser.username } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.user as Record<string, unknown>)?.isFollowedByMe).toBe(false);
  });

  it('should return false for your own profile', async () => {
    const { user, ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: GET_USER, variables: { username: user.username } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    expect((data.data?.user as Record<string, unknown>)?.isFollowedByMe).toBe(false);
  });
});

// ─── Additional GraphQL Operations ──────────────────────────────────────────

const FOLLOW_AIRPORT = `
  mutation FollowAirport($airportId: ID!) {
    followAirport(airportId: $airportId) {
      id
      icaoCode
      name
      isFollowedByMe
      followerCount
    }
  }
`;

const UNFOLLOW_AIRPORT = `
  mutation UnfollowAirport($airportId: ID!) {
    unfollowAirport(airportId: $airportId) {
      id
      icaoCode
      isFollowedByMe
      followerCount
    }
  }
`;

const FOLLOW_TOPIC = `
  mutation FollowTopic($targetType: String!, $value: String!) {
    followTopic(targetType: $targetType, value: $value) {
      targetType
      value
    }
  }
`;

const UNFOLLOW_TOPIC = `
  mutation UnfollowTopic($targetType: String!, $value: String!) {
    unfollowTopic(targetType: $targetType, value: $value) {
      targetType
      value
    }
  }
`;

const MY_FOLLOWING = `
  query MyFollowing($targetType: String) {
    myFollowing(targetType: $targetType) {
      id
      targetType
      user { id username }
      airport { id icaoCode }
      targetValue
      createdAt
    }
  }
`;

const FOLLOWING_FEED = `
  query FollowingFeed($first: Int, $after: String) {
    followingFeed(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          aircraftType
          airportCode
          user { id username }
        }
      }
      pageInfo { endCursor hasNextPage }
      totalCount
    }
  }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestAirport(overrides: Partial<{ icaoCode: string; iataCode: string; name: string }> = {}) {
  return prisma.airport.create({
    data: {
      icaoCode: overrides.icaoCode ?? 'KJFK',
      iataCode: overrides.iataCode ?? 'JFK',
      name: overrides.name ?? 'John F. Kennedy Intl',
      city: 'New York',
      country: 'US',
      latitude: 40.6413,
      longitude: -73.7781,
    },
  });
}

async function createTestPhoto(userId: string, overrides: Partial<{ aircraftType: string; airline: string; airportCode: string; caption: string }> = {}) {
  const key = `test/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  return prisma.photo.create({
    data: {
      userId,
      caption: overrides.caption ?? 'Test Photo',
      originalUrl: `https://localhost:4566/spotterhub/${key}`,
      aircraftType: overrides.aircraftType ?? null,
      airline: overrides.airline ?? null,
      airportCode: overrides.airportCode ?? null,
    },
  });
}

// ─── Airport Follow Tests ───────────────────────────────────────────────────

describe('Airport follow mutations', () => {
  it('should follow an airport successfully', async () => {
    const { ctx } = await createTestUser();
    const airport = await createTestAirport();

    const res = await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.followAirport).toMatchObject({
      id: airport.id,
      icaoCode: 'KJFK',
      isFollowedByMe: true,
      followerCount: 1,
    });
  });

  it('should be idempotent', async () => {
    const { ctx } = await createTestUser();
    const airport = await createTestAirport();

    await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );
    const res = await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.followAirport).toMatchObject({ followerCount: 1 });
  });

  it('should unfollow an airport successfully', async () => {
    const { ctx } = await createTestUser();
    const airport = await createTestAirport();

    await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );
    const res = await server.executeOperation(
      { query: UNFOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.unfollowAirport).toMatchObject({
      isFollowedByMe: false,
      followerCount: 0,
    });
  });

  it('should fail when airport does not exist', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: '00000000-0000-0000-0000-000000000000' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});

// ─── Topic Follow Tests ─────────────────────────────────────────────────────

describe('Topic follow mutations', () => {
  it('should follow an aircraft type', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'Boeing 747' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.followTopic).toEqual({ targetType: 'aircraft_type', value: 'Boeing 747' });
  });

  it('should follow a manufacturer', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'manufacturer', value: 'Airbus' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.followTopic).toEqual({ targetType: 'manufacturer', value: 'Airbus' });
  });

  it('should be idempotent', async () => {
    const { ctx } = await createTestUser();

    await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'A320' } },
      { contextValue: ctx },
    );
    const res = await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'A320' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
  });

  it('should unfollow a topic', async () => {
    const { ctx } = await createTestUser();

    await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'A320' } },
      { contextValue: ctx },
    );
    const res = await server.executeOperation(
      { query: UNFOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'A320' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.unfollowTopic).toEqual({ targetType: 'aircraft_type', value: 'A320' });
  });

  it('should fail for invalid targetType', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'invalid', value: 'test' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('should fail for empty value', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: '   ' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
    expect(data.errors).toBeDefined();
    expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

// ─── myFollowing Query Tests ────────────────────────────────────────────────

describe('myFollowing query', () => {
  it('should return all followed entities', async () => {
    const { ctx } = await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target2@example.com',
      username: 'target2',
      cognitoSub: 'test-sub-follow-target2',
    });
    const airport = await createTestAirport();

    await server.executeOperation(
      { query: FOLLOW_USER, variables: { userId: targetUser.id } },
      { contextValue: ctx },
    );
    await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );
    await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'Boeing 747' } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: MY_FOLLOWING },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const following = data.data?.myFollowing as Array<Record<string, unknown>>;
    expect(following).toHaveLength(3);
    const types = following.map((f) => f.targetType);
    expect(types).toContain('user');
    expect(types).toContain('airport');
    expect(types).toContain('aircraft_type');
  });

  it('should filter by targetType', async () => {
    const { ctx } = await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target2@example.com',
      username: 'target2',
      cognitoSub: 'test-sub-follow-target2',
    });
    const airport = await createTestAirport();

    await server.executeOperation(
      { query: FOLLOW_USER, variables: { userId: targetUser.id } },
      { contextValue: ctx },
    );
    await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: MY_FOLLOWING, variables: { targetType: 'airport' } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const following = data.data?.myFollowing as Array<Record<string, unknown>>;
    expect(following).toHaveLength(1);
    expect(following[0].targetType).toBe('airport');
  });

  it('should return empty when nothing is followed', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: MY_FOLLOWING },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    expect(data.data?.myFollowing).toEqual([]);
  });
});

// ─── followingFeed Query Tests ──────────────────────────────────────────────

describe('followingFeed query', () => {
  it('should return photos from followed users', async () => {
    const { ctx } = await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target2@example.com',
      username: 'target2',
      cognitoSub: 'test-sub-follow-target2',
    });

    await createTestPhoto(targetUser.id, { caption: 'Followed user photo' });

    await server.executeOperation(
      { query: FOLLOW_USER, variables: { userId: targetUser.id } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: FOLLOWING_FEED },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.followingFeed as { edges: Array<{ node: Record<string, unknown> }>; totalCount: number };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges[0].node.user).toMatchObject({ username: 'target2' });
  });

  it('should return photos matching followed airport codes', async () => {
    const { user, ctx } = await createTestUser();
    const airport = await createTestAirport({ icaoCode: 'EGLL', iataCode: 'LHR', name: 'Heathrow' });

    await createTestPhoto(user.id, { airportCode: 'EGLL' });

    await server.executeOperation(
      { query: FOLLOW_AIRPORT, variables: { airportId: airport.id } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: FOLLOWING_FEED },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.followingFeed as { totalCount: number; edges: Array<{ node: Record<string, unknown> }> };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges[0].node.airportCode).toBe('EGLL');
  });

  it('should return photos matching followed aircraft types', async () => {
    const { user, ctx } = await createTestUser();
    await createTestPhoto(user.id, { aircraftType: 'Boeing 747-400' });

    await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'aircraft_type', value: 'Boeing 747-400' } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: FOLLOWING_FEED },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.followingFeed as { totalCount: number; edges: Array<{ node: Record<string, unknown> }> };
    expect(feed.totalCount).toBe(1);
    expect(feed.edges[0].node.aircraftType).toBe('Boeing 747-400');
  });

  it('should return photos matching followed manufacturers', async () => {
    const { user, ctx } = await createTestUser();
    await createTestPhoto(user.id, { airline: 'Airbus' });

    await server.executeOperation(
      { query: FOLLOW_TOPIC, variables: { targetType: 'manufacturer', value: 'Airbus' } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: FOLLOWING_FEED },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.followingFeed as { totalCount: number };
    expect(feed.totalCount).toBe(1);
  });

  it('should return empty when nothing is followed', async () => {
    const { ctx } = await createTestUser();

    const res = await server.executeOperation(
      { query: FOLLOWING_FEED },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
    expect(data.errors).toBeUndefined();
    const feed = data.data?.followingFeed as { totalCount: number; edges: unknown[] };
    expect(feed.totalCount).toBe(0);
    expect(feed.edges).toEqual([]);
  });

  it('should support pagination', async () => {
    const { ctx } = await createTestUser();
    const { user: targetUser } = await createTestUser({
      email: 'target2@example.com',
      username: 'target2',
      cognitoSub: 'test-sub-follow-target2',
    });

    // Create 3 photos
    for (let i = 0; i < 3; i++) {
      await createTestPhoto(targetUser.id, { caption: `Photo ${i}` });
      // Small delay to ensure distinct createdAt
      await new Promise((r) => setTimeout(r, 10));
    }

    await server.executeOperation(
      { query: FOLLOW_USER, variables: { userId: targetUser.id } },
      { contextValue: ctx },
    );

    // First page
    const res1 = await server.executeOperation(
      { query: FOLLOWING_FEED, variables: { first: 2 } },
      { contextValue: ctx },
    );
    const data1 = (res1.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    const feed1 = data1.data?.followingFeed as { edges: Array<{ cursor: string }>; pageInfo: { endCursor: string; hasNextPage: boolean }; totalCount: number };
    expect(feed1.edges).toHaveLength(2);
    expect(feed1.pageInfo.hasNextPage).toBe(true);
    expect(feed1.totalCount).toBe(3);

    // Second page
    const res2 = await server.executeOperation(
      { query: FOLLOWING_FEED, variables: { first: 2, after: feed1.pageInfo.endCursor } },
      { contextValue: ctx },
    );
    const data2 = (res2.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    const feed2 = data2.data?.followingFeed as { edges: Array<{ cursor: string }>; pageInfo: { hasNextPage: boolean } };
    expect(feed2.edges).toHaveLength(1);
    expect(feed2.pageInfo.hasNextPage).toBe(false);
  });
});
