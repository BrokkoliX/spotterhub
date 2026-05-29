import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  cleanDatabase,
  createTestContext,
  createTestUser,
  prisma,
  setupTestServer,
  teardownTestServer,
} from './testHelpers.js';

let server: Awaited<ReturnType<typeof setupTestServer>>;

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

const DISMISS_FEED_WIDGET = `
  mutation DismissFeedWidget($widgetId: String!) {
    dismissFeedWidget(widgetId: $widgetId) {
      id
      username
      dismissedFeedWidgets
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      id
      dismissedFeedWidgets
    }
  }
`;

const USER_BY_USERNAME = `
  query UserByUsername($username: String!) {
    user(username: $username) {
      id
      dismissedFeedWidgets
    }
  }
`;

describe('Mutation: dismissFeedWidget', () => {
  it('appends a new widgetId to the authenticated user’s list and persists it', async () => {
    const { user, ctx } = await createTestUser({ username: 'alice', cognitoSub: 'sub-alice' });

    const res = await server.executeOperation(
      { query: DISMISS_FEED_WIDGET, variables: { widgetId: 'home_community_block' } },
      { contextValue: ctx },
    );

    expect(res.body.kind).toBe('single');
    if (res.body.kind !== 'single') return;
    expect(res.body.singleResult.errors).toBeUndefined();
    const data = res.body.singleResult.data as {
      dismissFeedWidget: { dismissedFeedWidgets: string[] };
    };
    expect(data.dismissFeedWidget.dismissedFeedWidgets).toEqual(['home_community_block']);

    // Persisted to the DB row, not just the response.
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.dismissedFeedWidgets).toEqual(['home_community_block']);
  });

  it('is idempotent — dismissing the same widgetId twice does not duplicate', async () => {
    const { user, ctx } = await createTestUser({ username: 'bob', cognitoSub: 'sub-bob' });

    await server.executeOperation(
      { query: DISMISS_FEED_WIDGET, variables: { widgetId: 'home_community_block' } },
      { contextValue: ctx },
    );
    const res = await server.executeOperation(
      { query: DISMISS_FEED_WIDGET, variables: { widgetId: 'home_community_block' } },
      { contextValue: ctx },
    );

    if (res.body.kind !== 'single') throw new Error('expected single result');
    expect(res.body.singleResult.errors).toBeUndefined();
    const data = res.body.singleResult.data as {
      dismissFeedWidget: { dismissedFeedWidgets: string[] };
    };
    expect(data.dismissFeedWidget.dismissedFeedWidgets).toEqual(['home_community_block']);

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.dismissedFeedWidgets).toEqual(['home_community_block']);
  });

  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const ctx = createTestContext(null);

    const res = await server.executeOperation(
      { query: DISMISS_FEED_WIDGET, variables: { widgetId: 'home_community_block' } },
      { contextValue: ctx },
    );

    if (res.body.kind !== 'single') throw new Error('expected single result');
    const errors = res.body.singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects empty / whitespace widgetId with BAD_USER_INPUT', async () => {
    const { ctx } = await createTestUser({ username: 'carol', cognitoSub: 'sub-carol' });

    const res = await server.executeOperation(
      { query: DISMISS_FEED_WIDGET, variables: { widgetId: '   ' } },
      { contextValue: ctx },
    );

    if (res.body.kind !== 'single') throw new Error('expected single result');
    const errors = res.body.singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('User.dismissedFeedWidgets field resolver', () => {
  it('returns the list to the account owner via `me`', async () => {
    const { user, ctx } = await createTestUser({ username: 'dave', cognitoSub: 'sub-dave' });
    await prisma.user.update({
      where: { id: user.id },
      data: { dismissedFeedWidgets: { set: ['home_community_block'] } },
    });

    const res = await server.executeOperation({ query: ME_QUERY }, { contextValue: ctx });
    if (res.body.kind !== 'single') throw new Error('expected single result');
    const data = res.body.singleResult.data as { me: { dismissedFeedWidgets: string[] } };
    expect(data.me.dismissedFeedWidgets).toEqual(['home_community_block']);
  });

  it('returns null when a different user queries the field', async () => {
    // dave's dismissed list is private; eve must not see it.
    const dave = await createTestUser({ username: 'dave2', cognitoSub: 'sub-dave2' });
    await prisma.user.update({
      where: { id: dave.user.id },
      data: { dismissedFeedWidgets: { set: ['home_community_block'] } },
    });
    // Make dave's profile public so the `user(username:...)` query can find him
    // even when the caller is someone else (otherwise the privacy check on the
    // `user` resolver short-circuits to null and we don't reach the field).
    await prisma.profile.create({ data: { userId: dave.user.id, isPublic: true } });

    const eve = await createTestUser({
      email: 'eve@example.com',
      username: 'eve',
      cognitoSub: 'sub-eve',
    });

    const res = await server.executeOperation(
      { query: USER_BY_USERNAME, variables: { username: 'dave2' } },
      { contextValue: eve.ctx },
    );
    if (res.body.kind !== 'single') throw new Error('expected single result');
    const data = res.body.singleResult.data as { user: { dismissedFeedWidgets: string[] | null } };
    expect(data.user.dismissedFeedWidgets).toBeNull();
  });
});
