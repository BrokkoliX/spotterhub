import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

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
      instagramHandle
      facebookUrl
      xHandle
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
        instagramHandle
        facebookUrl
        xHandle
      }
    }
  }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createUser(
  overrides: Partial<{ email: string; username: string; cognitoSub: string }> = {},
) {
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
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

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
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

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
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

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
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

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
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { interests: [] } } },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.interests).toEqual([]);
  });
});

// ─── Social Links ───────────────────────────────────────────────────────────

describe('Profile: updateProfile social links', () => {
  it('persists bare handles and a Facebook URL round-trip', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: {
          input: {
            instagramHandle: 'spotter.jane',
            xHandle: 'spotter_jane',
            facebookUrl: 'https://www.facebook.com/spotterjane',
          },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.instagramHandle).toBe('spotter.jane');
    expect(data.updateProfile.xHandle).toBe('spotter_jane');
    expect(data.updateProfile.facebookUrl).toBe('https://www.facebook.com/spotterjane');
  });

  it("strips a leading '@' from handle inputs", async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: { input: { instagramHandle: '@jane', xHandle: '@jane_x' } },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.instagramHandle).toBe('jane');
    expect(data.updateProfile.xHandle).toBe('jane_x');
  });

  it('extracts the handle from a pasted profile URL', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: {
          input: {
            instagramHandle: 'https://www.instagram.com/jane.doe/',
            // Legacy twitter.com URLs are also accepted and normalized to the
            // bare handle for storage.
            xHandle: 'https://twitter.com/jane_x?lang=en',
          },
        },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.instagramHandle).toBe('jane.doe');
    expect(data.updateProfile.xHandle).toBe('jane_x');
  });

  it('treats empty string and null as "clear this field"', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: {
        userId: user.id,
        instagramHandle: 'old_ig',
        xHandle: 'old_x',
        facebookUrl: 'https://www.facebook.com/old',
      },
    });
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: { input: { instagramHandle: '', xHandle: null, facebookUrl: '   ' } },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateProfile.instagramHandle).toBeNull();
    expect(data.updateProfile.xHandle).toBeNull();
    expect(data.updateProfile.facebookUrl).toBeNull();
  });

  it('rejects handles with disallowed characters', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { instagramHandle: 'bad name!' } } },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].message).toMatch(/Instagram/i);
    expect(errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('rejects a Facebook URL that is not http(s)', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: { input: { facebookUrl: 'javascript:alert(1)' } },
      },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].message).toMatch(/Facebook/i);
    expect(errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('rejects a Facebook URL that is not a parseable URL', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      { query: UPDATE_PROFILE, variables: { input: { facebookUrl: 'not a url' } } },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('rejects an over-long handle', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_PROFILE,
        variables: { input: { instagramHandle: 'a'.repeat(31) } },
      },
      { contextValue: ctx },
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('Profile: updateAvatar', () => {
  it('sets avatar URL on existing profile', async () => {
    const user = await createUser();
    await prisma.profile.create({
      data: { userId: user.id, displayName: 'Test' },
    });
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_AVATAR,
        variables: { avatarUrl: 'http://localhost:4566/spotterspace-photos/avatar.jpg' },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateAvatar.avatarUrl).toBe(
      'http://localhost:4566/spotterspace-photos/avatar.jpg',
    );
  });

  it('creates profile if none exists and sets avatar', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation(
      {
        query: UPDATE_AVATAR,
        variables: { avatarUrl: 'http://localhost:4566/spotterspace-photos/new.jpg' },
      },
      { contextValue: ctx },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.updateAvatar.avatarUrl).toBe('http://localhost:4566/spotterspace-photos/new.jpg');
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
        avatarUrl: 'http://localhost:4566/spotterspace-photos/bob.jpg',
        locationRegion: 'Europe',
        experienceLevel: 'intermediate',
        gear: 'Sony A7IV',
        interests: ['cargo'],
        favoriteAircraft: ['787'],
        favoriteAirports: ['EGLL'],
        isPublic: true,
        instagramHandle: 'bob_spotter',
        xHandle: 'bob_x',
        facebookUrl: 'https://www.facebook.com/bobspotter',
      },
    });
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation({ query: ME_QUERY }, { contextValue: ctx });

    const data = (res.body as any).singleResult.data;
    expect(data.me.profile).toMatchObject({
      displayName: 'Bob',
      bio: 'Spotter',
      avatarUrl: 'http://localhost:4566/spotterspace-photos/bob.jpg',
      locationRegion: 'Europe',
      experienceLevel: 'intermediate',
      gear: 'Sony A7IV',
      interests: ['cargo'],
      favoriteAircraft: ['787'],
      favoriteAirports: ['EGLL'],
      isPublic: true,
      instagramHandle: 'bob_spotter',
      xHandle: 'bob_x',
      facebookUrl: 'https://www.facebook.com/bobspotter',
    });
  });

  it('returns null profile when none exists', async () => {
    const user = await createUser();
    const ctx = createTestContext({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    const res = await server.executeOperation({ query: ME_QUERY }, { contextValue: ctx });

    const data = (res.body as any).singleResult.data;
    expect(data.me.profile).toBeNull();
  });
});
