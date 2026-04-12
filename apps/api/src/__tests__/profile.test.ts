import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import type { Context } from '../context.js';

import {
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

// ─── Mutations ──────────────────────────────────────────────────────────────

const UPDATE_PROFILE = `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      displayName
      bio
      avatarUrl
      locationRegion
      experienceLevel
      gear
      interests
      favoriteAircraft
      favoriteAirports
      isPublic
    }
  }
`;

const UPDATE_AVATAR = `
  mutation UpdateAvatar($avatarUrl: String!) {
    updateAvatar(avatarUrl: $avatarUrl) {
      avatarUrl
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      id
      username
      profile {
        displayName
        bio
        avatarUrl
        locationRegion
        experienceLevel
        gear
        interests
        favoriteAircraft
        favoriteAirports
        isPublic
      }
    }
  }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createUser(overrides: Partial<{ email: string; username: string; cognitoSub: string }> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? 'profileuser@example.com',
      username: overrides.username ?? 'profileuser',
      cognitoSub: overrides.cognitoSub ?? 'test-sub-profile-1',
    },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Profile: updateProfile', () => {
  it('creates a profile if none exists', async () => {
    const user = await createUser();
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { displayName: 'Test User' } } },
      { contextValue: ctx },
    );

    expect(res.body.kind).toBe('single');
    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.displayName).toBe('Test User');
    expect(data.updateProfile.isPublic).toBe(true);
  });

  it('updates an existing profile', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: { userId: user.id, displayName: 'Old Name' },
    });
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: {
          input: {
            displayName: 'New Name',
            bio: 'Aviation photographer',
            locationRegion: 'Pacific Northwest',
            experienceLevel: 'advanced',
            gear: 'Canon R5',
            interests: ['commercial', 'military'],
            favoriteAircraft: ['A380', '747'],
            favoriteAirports: ['KSEA', 'KLAX'],
            isPublic: false,
          },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.displayName).toBe('New Name');
    expect(data.updateProfile.bio).toBe('Aviation photographer');
    expect(data.updateProfile.locationRegion).toBe('Pacific Northwest');
    expect(data.updateProfile.experienceLevel).toBe('advanced');
    expect(data.updateProfile.gear).toBe('Canon R5');
    expect(data.updateProfile.interests).toEqual(['commercial', 'military']);
    expect(data.updateProfile.favoriteAircraft).toEqual(['A380', '747']);
    expect(data.updateProfile.favoriteAirports).toEqual(['KSEA', 'KLAX']);
    expect(data.updateProfile.isPublic).toBe(false);
  });

  it('allows partial updates without resetting other fields', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: { userId: user.id, displayName: 'Alice', bio: 'Hello world', gear: 'Nikon Z9' },
    });
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { bio: 'Updated bio' } } },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.bio).toBe('Updated bio');
    // Other fields should be preserved
    expect(data.updateProfile.displayName).toBe('Alice');
    expect(data.updateProfile.gear).toBe('Nikon Z9');
  });

  it('rejects invalid experience level', async () => {
    const user = await createUser();
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { experienceLevel: 'expert' } } },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/experience/i);
  });

  it('requires authentication', async () => {
    const ctx = createTestContext(null);

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { displayName: 'Anon' } } },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('handles empty arrays for list fields', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: { userId: user.id, interests: ['military'] },
    });
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { interests: [] } } },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.interests).toEqual([]);
  });
});

describe('Profile: updateAvatar', () => {
  it('sets avatar URL on existing profile', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: { userId: user.id, displayName: 'Test' },
    });
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: UPDATE_AVATAR, variables: { avatarUrl: 'http://localhost:4566/spotterhub-photos/avatar.jpg' } },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateAvatar.avatarUrl).toBe('http://localhost:4566/spotterhub-photos/avatar.jpg');
  });

  it('creates profile if none exists and sets avatar', async () => {
    const user = await createUser();
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: UPDATE_AVATAR, variables: { avatarUrl: 'http://localhost:4566/spotterhub-photos/new.jpg' } },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateAvatar.avatarUrl).toBe('http://localhost:4566/spotterhub-photos/new.jpg');
  });

  it('requires authentication', async () => {
    const ctx = createTestContext(null);

    const res = await server.executeOperation(
      { query: UPDATE_AVATAR, variables: { avatarUrl: 'http://example.com/a.jpg' } },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].extensions?.code).toBe('UNAUTHENTICATED');
  });
});

describe('Profile: me query with profile', () => {
  it('returns full profile data on me query', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: 'Bob',
        bio: 'Spotter',
        avatarUrl: 'http://localhost:4566/spotterhub-photos/bob.jpg',
        locationRegion: 'Europe',
        experienceLevel: 'intermediate',
        gear: 'Sony A7IV',
        interests: ['cargo'],
        favoriteAircraft: ['787'],
        favoriteAirports: ['EGLL'],
        isPublic: true,
      },
    });
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: ME_QUERY },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.me.profile).toMatchObject({
      displayName: 'Bob',
      bio: 'Spotter',
      avatarUrl: 'http://localhost:4566/spotterhub-photos/bob.jpg',
      locationRegion: 'Europe',
      experienceLevel: 'intermediate',
      gear: 'Sony A7IV',
      interests: ['cargo'],
      favoriteAircraft: ['787'],
      favoriteAirports: ['EGLL'],
      isPublic: true,
    });
  });

  it('returns null profile when none exists', async () => {
    const user = await createUser();
    const ctx = createTestContext({ sub: user.cognitoSub, email: user.email, username: user.username });

    const res = await server.executeOperation(
      { query: ME_QUERY },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.me.profile).toBeNull();
  });
});
