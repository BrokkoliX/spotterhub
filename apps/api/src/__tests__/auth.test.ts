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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Auth: signUp', () => {
  it('creates a new user and returns a JWT token', async () => {
    const result = await server.executeOperation(
      {
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              token
              user { id email username role status profile { displayName } }
            }
          }
        `,
        variables: {
          input: {
            email: 'test@example.com',
            username: 'testuser',
            password: 'securepass123',
          },
        },
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;

    const { data, errors } = result.body.singleResult;
    expect(errors).toBeUndefined();
    expect(data?.signUp).toBeDefined();

    const signUp = data!.signUp as {
      token: string;
      user: { email: string; username: string; role: string; status: string; profile: { displayName: string } };
    };
    expect(signUp.token).toBeTruthy();
    expect(signUp.user.email).toBe('test@example.com');
    expect(signUp.user.username).toBe('testuser');
    expect(signUp.user.role).toBe('user');
    expect(signUp.user.status).toBe('active');
    expect(signUp.user.profile.displayName).toBe('testuser');
  });

  it('rejects duplicate email', async () => {
    // Create first user
    await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "dupe@example.com", username: "user1", password: "password123" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    // Try duplicate email
    const result = await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "dupe@example.com", username: "user2", password: "password123" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.errors).toBeDefined();
    expect(result.body.singleResult.errors![0].message).toContain('email');
  });

  it('rejects invalid username (too short)', async () => {
    const result = await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "short@example.com", username: "ab", password: "password123" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.errors).toBeDefined();
    expect(result.body.singleResult.errors![0].message).toContain('at least 3');
  });

  it('rejects short password', async () => {
    const result = await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "pw@example.com", username: "validuser", password: "short" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.errors).toBeDefined();
    expect(result.body.singleResult.errors![0].message).toContain('8 characters');
  });
});

describe('Auth: signIn', () => {
  beforeEach(async () => {
    await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "login@example.com", username: "loginuser", password: "password123" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );
  });

  it('returns a token for valid credentials', async () => {
    const result = await server.executeOperation(
      {
        query: `mutation { signIn(input: { email: "login@example.com", password: "password123" }) { token user { username } } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    const { data, errors } = result.body.singleResult;
    expect(errors).toBeUndefined();
    expect(data?.signIn).toBeDefined();
    const signIn = data!.signIn as { token: string; user: { username: string } };
    expect(signIn.token).toBeTruthy();
    expect(signIn.user.username).toBe('loginuser');
  });

  it('rejects wrong password', async () => {
    const result = await server.executeOperation(
      {
        query: `mutation { signIn(input: { email: "login@example.com", password: "wrongpassword" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.errors).toBeDefined();
    expect(result.body.singleResult.errors![0].message).toContain('Invalid email or password');
  });
});

describe('Auth: me query', () => {
  it('returns null when unauthenticated', async () => {
    const result = await server.executeOperation(
      { query: `query { me { id } }` },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.data?.me).toBeNull();
  });

  it('returns the authenticated user', async () => {
    // Create user first
    const signUpResult = await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "me@example.com", username: "meuser", password: "password123" }) { token user { id } } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(signUpResult.body.kind).toBe('single');
    if (signUpResult.body.kind !== 'single') return;

    // Find the user's cognitoSub
    const user = await prisma.user.findUnique({ where: { email: 'me@example.com' } });
    expect(user).toBeTruthy();

    const result = await server.executeOperation(
      { query: `query { me { id email username profile { displayName } } }` },
      {
        contextValue: createTestContext({
          sub: user!.cognitoSub,
          email: user!.email,
          username: user!.username,
        }),
      },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    const { data, errors } = result.body.singleResult;
    expect(errors).toBeUndefined();
    const me = data?.me as { email: string; username: string };
    expect(me.email).toBe('me@example.com');
    expect(me.username).toBe('meuser');
  });
});

describe('Profile: updateProfile', () => {
  it('rejects unauthenticated requests', async () => {
    const result = await server.executeOperation(
      {
        query: `mutation { updateProfile(input: { bio: "Hello" }) { id } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.errors).toBeDefined();
    expect(result.body.singleResult.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('updates an existing profile', async () => {
    // Create user
    await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "profile@example.com", username: "profileuser", password: "password123" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    const user = await prisma.user.findUnique({ where: { email: 'profile@example.com' } });

    const result = await server.executeOperation(
      {
        query: `
          mutation UpdateProfile($input: UpdateProfileInput!) {
            updateProfile(input: $input) {
              bio
              locationRegion
              experienceLevel
              interests
              favoriteAircraft
            }
          }
        `,
        variables: {
          input: {
            bio: 'Aviation photographer',
            locationRegion: 'Pacific Northwest',
            experienceLevel: 'intermediate',
            interests: ['commercial', 'cargo'],
            favoriteAircraft: ['747', 'A350'],
          },
        },
      },
      {
        contextValue: createTestContext({
          sub: user!.cognitoSub,
          email: user!.email,
          username: user!.username,
        }),
      },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    const { data, errors } = result.body.singleResult;
    expect(errors).toBeUndefined();
    const profile = data?.updateProfile as {
      bio: string;
      locationRegion: string;
      experienceLevel: string;
      interests: string[];
      favoriteAircraft: string[];
    };
    expect(profile.bio).toBe('Aviation photographer');
    expect(profile.locationRegion).toBe('Pacific Northwest');
    expect(profile.experienceLevel).toBe('intermediate');
    expect(profile.interests).toEqual(['commercial', 'cargo']);
    expect(profile.favoriteAircraft).toEqual(['747', 'A350']);
  });
});

describe('Query: user(username)', () => {
  it('returns a public user by username', async () => {
    await server.executeOperation(
      {
        query: `mutation { signUp(input: { email: "public@example.com", username: "publicuser", password: "password123" }) { token } }`,
      },
      { contextValue: createTestContext() },
    );

    const result = await server.executeOperation(
      {
        query: `query { user(username: "publicuser") { username followerCount followingCount photoCount } }`,
      },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    const { data, errors } = result.body.singleResult;
    expect(errors).toBeUndefined();
    const user = data?.user as { username: string; followerCount: number };
    expect(user.username).toBe('publicuser');
    expect(user.followerCount).toBe(0);
  });

  it('returns null for non-existent username', async () => {
    const result = await server.executeOperation(
      { query: `query { user(username: "nobody") { id } }` },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    expect(result.body.singleResult.data?.user).toBeNull();
  });
});

describe('Query: health', () => {
  it('returns ok with database connected', async () => {
    const result = await server.executeOperation(
      { query: `query { health { status dbConnected timestamp } }` },
      { contextValue: createTestContext() },
    );

    expect(result.body.kind).toBe('single');
    if (result.body.kind !== 'single') return;
    const health = result.body.singleResult.data?.health as { status: string; dbConnected: boolean };
    expect(health.status).toBe('ok');
    expect(health.dbConnected).toBe(true);
  });
});
