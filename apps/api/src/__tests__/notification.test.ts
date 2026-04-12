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

// ─── Test helpers ─────────────────────────────────────────────────────────────

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

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const GET_NOTIFICATIONS = `
  query GetNotifications($first: Int, $after: String, $unreadOnly: Boolean) {
    notifications(first: $first, after: $after, unreadOnly: $unreadOnly) {
      edges {
        cursor
        node {
          id
          type
          title
          body
          isRead
          createdAt
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const GET_UNREAD_COUNT = `
  query GetUnreadCount {
    unreadNotificationCount
  }
`;

const MARK_READ = `
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

const MARK_ALL_READ = `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

const DELETE_NOTIFICATION = `
  mutation DeleteNotification($id: ID!) {
    deleteNotification(id: $id)
  }
`;

const LIKE_PHOTO = `
  mutation LikePhoto($photoId: ID!) {
    likePhoto(photoId: $photoId) { id likeCount }
  }
`;

const FOLLOW_USER = `
  mutation FollowUser($userId: ID!) {
    followUser(userId: $userId) { id username }
  }
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('notifications query', () => {
  it('returns empty for a new user', async () => {
    const { ctx } = await createTestUser();
    const res = await server.executeOperation(
      { query: GET_NOTIFICATIONS, variables: { first: 10 } },
      { contextValue: ctx },
    );
    expect(res.body.kind).toBe('single');
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    const edges = (data.notifications as { edges: unknown[] }).edges;
    expect(edges).toHaveLength(0);
  });

  it('returns notifications in descending order', async () => {
    const { user, ctx } = await createTestUser();
    // Create two notifications manually
    await prisma.notification.create({
      data: { userId: user.id, type: 'system', title: 'First', createdAt: new Date('2024-01-01') },
    });
    await prisma.notification.create({
      data: { userId: user.id, type: 'system', title: 'Second', createdAt: new Date('2024-01-02') },
    });

    const res = await server.executeOperation(
      { query: GET_NOTIFICATIONS, variables: { first: 10 } },
      { contextValue: ctx },
    );
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    const edges = (data.notifications as { edges: { node: { title: string } }[] }).edges;
    expect(edges).toHaveLength(2);
    expect(edges[0].node.title).toBe('Second'); // newer first
    expect(edges[1].node.title).toBe('First');
  });

  it('filters to unread only', async () => {
    const { user, ctx } = await createTestUser();
    await prisma.notification.create({
      data: { userId: user.id, type: 'system', title: 'Unread', isRead: false },
    });
    await prisma.notification.create({
      data: { userId: user.id, type: 'system', title: 'Read', isRead: true },
    });

    const res = await server.executeOperation(
      { query: GET_NOTIFICATIONS, variables: { first: 10, unreadOnly: true } },
      { contextValue: ctx },
    );
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    const edges = (data.notifications as { edges: { node: { title: string } }[] }).edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].node.title).toBe('Unread');
  });

  it('requires authentication', async () => {
    const unauthCtx = createTestContext(null);
    const res = await server.executeOperation(
      { query: GET_NOTIFICATIONS, variables: { first: 10 } },
      { contextValue: unauthCtx },
    );
    const result = (res.body as { kind: 'single'; singleResult: { errors?: { message: string }[] } }).singleResult;
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toMatch(/logged in|not authenticated/i);
  });
});

describe('unreadNotificationCount', () => {
  it('returns 0 for unauthenticated user', async () => {
    const unauthCtx = createTestContext(null);
    const res = await server.executeOperation(
      { query: GET_UNREAD_COUNT },
      { contextValue: unauthCtx },
    );
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    expect(data.unreadNotificationCount).toBe(0);
  });

  it('returns the correct unread count', async () => {
    const { user, ctx } = await createTestUser();
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'system', title: 'A', isRead: false },
        { userId: user.id, type: 'system', title: 'B', isRead: false },
        { userId: user.id, type: 'system', title: 'C', isRead: true },
      ],
    });
    const res = await server.executeOperation({ query: GET_UNREAD_COUNT }, { contextValue: ctx });
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    expect(data.unreadNotificationCount).toBe(2);
  });
});

describe('markNotificationRead', () => {
  it('marks a notification as read', async () => {
    const { user, ctx } = await createTestUser();
    const notif = await prisma.notification.create({
      data: { userId: user.id, type: 'system', title: 'Test', isRead: false },
    });

    const res = await server.executeOperation(
      { query: MARK_READ, variables: { id: notif.id } },
      { contextValue: ctx },
    );
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    const updated = data.markNotificationRead as { id: string; isRead: boolean };
    expect(updated.id).toBe(notif.id);
    expect(updated.isRead).toBe(true);
  });

  it("forbids marking another user's notification", async () => {
    const { user: owner } = await createTestUser();
    const { ctx: otherCtx } = await createTestUser({
      email: 'other@example.com',
      username: 'other',
      cognitoSub: 'sub-other',
    });

    const notif = await prisma.notification.create({
      data: { userId: owner.id, type: 'system', title: 'Private', isRead: false },
    });

    const res = await server.executeOperation(
      { query: MARK_READ, variables: { id: notif.id } },
      { contextValue: otherCtx },
    );
    const result = (res.body as { kind: 'single'; singleResult: { errors?: { extensions: { code: string } }[] } }).singleResult;
    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions.code).toBe('FORBIDDEN');
  });
});

describe('markAllNotificationsRead', () => {
  it('marks all notifications as read', async () => {
    const { user, ctx } = await createTestUser();
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'system', title: 'A', isRead: false },
        { userId: user.id, type: 'system', title: 'B', isRead: false },
      ],
    });

    const res = await server.executeOperation({ query: MARK_ALL_READ }, { contextValue: ctx });
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    expect(data.markAllNotificationsRead).toBe(true);

    const remaining = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
    expect(remaining).toBe(0);
  });
});

describe('deleteNotification', () => {
  it('deletes own notification', async () => {
    const { user, ctx } = await createTestUser();
    const notif = await prisma.notification.create({
      data: { userId: user.id, type: 'system', title: 'Delete me', isRead: false },
    });

    const res = await server.executeOperation(
      { query: DELETE_NOTIFICATION, variables: { id: notif.id } },
      { contextValue: ctx },
    );
    const data = (res.body as { kind: 'single'; singleResult: { data: Record<string, unknown> } }).singleResult.data;
    expect(data.deleteNotification).toBe(true);

    const found = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(found).toBeNull();
  });

  it("forbids deleting another user's notification", async () => {
    const { user: owner } = await createTestUser();
    const { ctx: otherCtx } = await createTestUser({
      email: 'other2@example.com',
      username: 'other2',
      cognitoSub: 'sub-other2',
    });

    const notif = await prisma.notification.create({
      data: { userId: owner.id, type: 'system', title: 'Not yours', isRead: false },
    });

    const res = await server.executeOperation(
      { query: DELETE_NOTIFICATION, variables: { id: notif.id } },
      { contextValue: otherCtx },
    );
    const result = (res.body as { kind: 'single'; singleResult: { errors?: { extensions: { code: string } }[] } }).singleResult;
    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions.code).toBe('FORBIDDEN');
  });
});

describe('notification triggers', () => {
  it('liking a photo creates a like notification for the photo owner', async () => {
    const { user: owner } = await createTestUser({
      email: 'owner@example.com',
      username: 'photoowner',
      cognitoSub: 'sub-owner',
    });
    const { ctx: likerCtx } = await createTestUser({
      email: 'liker@example.com',
      username: 'liker',
      cognitoSub: 'sub-liker',
    });

    const photo = await createTestPhoto(owner.id);

    await server.executeOperation(
      { query: LIKE_PHOTO, variables: { photoId: photo.id } },
      { contextValue: likerCtx },
    );

    // Give async notification a moment (createNotification is fire-and-forget but still awaited internally)
    await new Promise((r) => setTimeout(r, 50));

    const notifs = await prisma.notification.findMany({ where: { userId: owner.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('like');
    expect(notifs[0].title).toBe('❤️ New like');
    expect(notifs[0].body).toBe('@liker liked your photo');
  });

  it('does not notify on self-like', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    await server.executeOperation(
      { query: LIKE_PHOTO, variables: { photoId: photo.id } },
      { contextValue: ctx },
    );

    await new Promise((r) => setTimeout(r, 50));

    const notifs = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifs).toHaveLength(0);
  });

  it('following a user creates a follow notification', async () => {
    const { user: target } = await createTestUser({
      email: 'target@example.com',
      username: 'targetuser',
      cognitoSub: 'sub-target',
    });
    const { ctx: followerCtx } = await createTestUser({
      email: 'follower@example.com',
      username: 'followeruser',
      cognitoSub: 'sub-follower',
    });

    await server.executeOperation(
      { query: FOLLOW_USER, variables: { userId: target.id } },
      { contextValue: followerCtx },
    );

    await new Promise((r) => setTimeout(r, 50));

    const notifs = await prisma.notification.findMany({ where: { userId: target.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('follow');
    expect(notifs[0].title).toBe('👤 New follower');
    expect(notifs[0].body).toBe('@followeruser started following you');
  });
});
