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

const ADMIN_USER = { sub: 'sub-admin', email: 'admin@test.com', username: 'admin' };
const MOD_USER = { sub: 'sub-mod', email: 'mod@test.com', username: 'moderator' };
const REGULAR_USER = { sub: 'sub-regular', email: 'user@test.com', username: 'regular' };

function ctx(user: Context['user'] = null): { contextValue: Context } {
  return { contextValue: createTestContext(user) };
}

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const ADMIN_STATS = `
  query AdminStats {
    adminStats {
      totalUsers
      totalPhotos
      pendingPhotos
      openReports
      totalAirports
      totalSpottingLocations
    }
  }
`;

const ADMIN_REPORTS = `
  query AdminReports($status: String, $first: Int) {
    adminReports(status: $status, first: $first) {
      edges {
        node {
          id
          targetType
          targetId
          reason
          status
          reporter { id username }
          reviewer { id username }
          resolvedAt
        }
      }
      totalCount
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ADMIN_USERS = `
  query AdminUsers($role: String, $status: String, $search: String, $first: Int) {
    adminUsers(role: $role, status: $status, search: $search, first: $first) {
      edges {
        node { id username email role status }
      }
      totalCount
    }
  }
`;

const ADMIN_PHOTOS = `
  query AdminPhotos($moderationStatus: String, $first: Int) {
    adminPhotos(moderationStatus: $moderationStatus, first: $first) {
      edges {
        node { id moderationStatus user { username } }
      }
      totalCount
    }
  }
`;

const RESOLVE_REPORT = `
  mutation AdminResolveReport($id: ID!, $action: String!) {
    adminResolveReport(id: $id, action: $action) {
      id
      status
      reviewer { username }
      resolvedAt
    }
  }
`;

const UPDATE_USER_STATUS = `
  mutation AdminUpdateUserStatus($userId: ID!, $status: String!) {
    adminUpdateUserStatus(userId: $userId, status: $status) {
      id
      status
    }
  }
`;

const UPDATE_USER_ROLE = `
  mutation AdminUpdateUserRole($userId: ID!, $role: String!) {
    adminUpdateUserRole(userId: $userId, role: $role) {
      id
      role
    }
  }
`;

const UPDATE_PHOTO_MODERATION = `
  mutation AdminUpdatePhotoModeration($photoId: ID!, $status: String!) {
    adminUpdatePhotoModeration(photoId: $photoId, status: $status) {
      id
      moderationStatus
    }
  }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createUsers() {
  const admin = await prisma.user.create({
    data: { email: 'admin@test.com', username: 'admin', cognitoSub: 'sub-admin', role: 'admin' },
  });
  const mod = await prisma.user.create({
    data: {
      email: 'mod@test.com',
      username: 'moderator',
      cognitoSub: 'sub-mod',
      role: 'moderator',
    },
  });
  const regular = await prisma.user.create({
    data: { email: 'user@test.com', username: 'regular', cognitoSub: 'sub-regular', role: 'user' },
  });
  return { admin, mod, regular };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('adminStats', () => {
  it('returns platform statistics for admin', async () => {
    const { regular } = await createUsers();
    await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'pending',
      },
    });

    const res = await server.executeOperation({ query: ADMIN_STATS }, ctx(ADMIN_USER));

    const data = (res.body as any).singleResult.data;
    expect(data.adminStats.totalUsers).toBe(3);
    expect(data.adminStats.totalPhotos).toBe(1);
    expect(data.adminStats.pendingPhotos).toBe(1);
  });

  it('works for moderator role', async () => {
    await createUsers();

    const res = await server.executeOperation({ query: ADMIN_STATS }, ctx(MOD_USER));

    const data = (res.body as any).singleResult.data;
    expect(data.adminStats.totalUsers).toBe(3);
  });

  it('rejects regular user', async () => {
    await createUsers();

    const res = await server.executeOperation({ query: ADMIN_STATS }, ctx(REGULAR_USER));

    const errors = (res.body as any).singleResult.errors;
    expect(errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('rejects unauthenticated user', async () => {
    const res = await server.executeOperation({ query: ADMIN_STATS }, ctx(null));

    const errors = (res.body as any).singleResult.errors;
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});

describe('adminReports', () => {
  it('returns paginated reports', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'approved',
      },
    });
    await prisma.report.create({
      data: {
        reporterId: regular.id,
        targetType: 'photo',
        targetId: photo.id,
        reason: 'spam',
      },
    });

    const res = await server.executeOperation(
      { query: ADMIN_REPORTS, variables: { status: 'open' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminReports.totalCount).toBe(1);
    expect(data.adminReports.edges[0].node.reason).toBe('spam');
    expect(data.adminReports.edges[0].node.reporter.username).toBe('regular');
  });

  it('filters by status', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
      },
    });
    await prisma.report.create({
      data: {
        reporterId: regular.id,
        targetType: 'photo',
        targetId: photo.id,
        reason: 'spam',
        status: 'resolved',
      },
    });

    const res = await server.executeOperation(
      { query: ADMIN_REPORTS, variables: { status: 'open' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminReports.totalCount).toBe(0);
  });
});

describe('adminResolveReport', () => {
  it('resolves a report', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
      },
    });
    const report = await prisma.report.create({
      data: {
        reporterId: regular.id,
        targetType: 'photo',
        targetId: photo.id,
        reason: 'spam',
      },
    });

    const res = await server.executeOperation(
      { query: RESOLVE_REPORT, variables: { id: report.id, action: 'resolved' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminResolveReport.status).toBe('resolved');
    expect(data.adminResolveReport.reviewer.username).toBe('admin');
    expect(data.adminResolveReport.resolvedAt).toBeTruthy();
  });

  it('dismisses a report', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
      },
    });
    const report = await prisma.report.create({
      data: {
        reporterId: regular.id,
        targetType: 'photo',
        targetId: photo.id,
        reason: 'inappropriate',
      },
    });

    const res = await server.executeOperation(
      { query: RESOLVE_REPORT, variables: { id: report.id, action: 'dismissed' } },
      ctx(MOD_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminResolveReport.status).toBe('dismissed');
  });

  it('rejects invalid action', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
      },
    });
    const report = await prisma.report.create({
      data: {
        reporterId: regular.id,
        targetType: 'photo',
        targetId: photo.id,
        reason: 'spam',
      },
    });

    const res = await server.executeOperation(
      { query: RESOLVE_REPORT, variables: { id: report.id, action: 'invalid' } },
      ctx(ADMIN_USER),
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });
});

describe('adminUpdateUserStatus', () => {
  it('suspends a user', async () => {
    const { regular } = await createUsers();

    const res = await server.executeOperation(
      { query: UPDATE_USER_STATUS, variables: { userId: regular.id, status: 'suspended' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminUpdateUserStatus.status).toBe('suspended');
  });

  it('requires admin role (not moderator)', async () => {
    const { regular } = await createUsers();

    const res = await server.executeOperation(
      { query: UPDATE_USER_STATUS, variables: { userId: regular.id, status: 'suspended' } },
      ctx(MOD_USER),
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors[0].extensions.code).toBe('FORBIDDEN');
  });
});

describe('adminUpdateUserRole', () => {
  it('promotes a user to moderator', async () => {
    const { regular } = await createUsers();

    const res = await server.executeOperation(
      { query: UPDATE_USER_ROLE, variables: { userId: regular.id, role: 'moderator' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminUpdateUserRole.role).toBe('moderator');
  });

  it('requires admin role', async () => {
    const { regular } = await createUsers();

    const res = await server.executeOperation(
      { query: UPDATE_USER_ROLE, variables: { userId: regular.id, role: 'admin' } },
      ctx(MOD_USER),
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors[0].extensions.code).toBe('FORBIDDEN');
  });
});

describe('adminUpdatePhotoModeration', () => {
  it('approves a photo', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'pending',
      },
    });

    const res = await server.executeOperation(
      { query: UPDATE_PHOTO_MODERATION, variables: { photoId: photo.id, status: 'approved' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminUpdatePhotoModeration.moderationStatus).toBe('approved');
  });

  it('rejects a photo', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'pending',
      },
    });

    const res = await server.executeOperation(
      { query: UPDATE_PHOTO_MODERATION, variables: { photoId: photo.id, status: 'rejected' } },
      ctx(MOD_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminUpdatePhotoModeration.moderationStatus).toBe('rejected');
  });

  it('rejects invalid status', async () => {
    const { regular } = await createUsers();
    const photo = await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
      },
    });

    const res = await server.executeOperation(
      { query: UPDATE_PHOTO_MODERATION, variables: { photoId: photo.id, status: 'nope' } },
      ctx(ADMIN_USER),
    );

    const errors = (res.body as any).singleResult.errors;
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });
});

describe('adminUsers', () => {
  it('lists users with filters', async () => {
    await createUsers();

    const res = await server.executeOperation(
      { query: ADMIN_USERS, variables: { role: 'admin' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminUsers.totalCount).toBe(1);
    expect(data.adminUsers.edges[0].node.username).toBe('admin');
  });

  it('searches by username', async () => {
    await createUsers();

    const res = await server.executeOperation(
      { query: ADMIN_USERS, variables: { search: 'mod' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminUsers.totalCount).toBe(1);
    expect(data.adminUsers.edges[0].node.username).toBe('moderator');
  });
});

describe('adminPhotos', () => {
  it('lists photos by moderation status', async () => {
    const { regular } = await createUsers();
    await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/a.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'pending',
      },
    });
    await prisma.photo.create({
      data: {
        userId: regular.id,
        originalUrl: 'http://localhost:4566/b.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'approved',
      },
    });

    const res = await server.executeOperation(
      { query: ADMIN_PHOTOS, variables: { moderationStatus: 'pending' } },
      ctx(ADMIN_USER),
    );

    const data = (res.body as any).singleResult.data;
    expect(data.adminPhotos.totalCount).toBe(1);
    expect(data.adminPhotos.edges[0].node.moderationStatus).toBe('pending');
  });
});
