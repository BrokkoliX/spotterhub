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

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const ADD_COMMENT = `
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      id
      body
      user { id username }
      replies { id body }
      createdAt
    }
  }
`;

const UPDATE_COMMENT = `
  mutation UpdateComment($id: ID!, $body: String!) {
    updateComment(id: $id, body: $body) {
      id
      body
    }
  }
`;

const DELETE_COMMENT = `
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;

const GET_COMMENTS = `
  query Comments($photoId: ID!, $first: Int) {
    comments(photoId: $photoId, first: $first) {
      edges {
        cursor
        node {
          id
          body
          user { id username }
          replies {
            id
            body
            user { id username }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Comment mutations', () => {
  describe('addComment', () => {
    it('should add a comment to a photo', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const res = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Great shot!' } } },
        { contextValue: ctx },
      );

      expect(res.body.kind).toBe('single');
      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      const comment = data.data?.addComment as Record<string, unknown>;
      expect(comment?.body).toBe('Great shot!');
      expect((comment?.user as Record<string, unknown>)?.id).toBe(user.id);
    });

    it('should add a reply to an existing comment', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      // Add parent comment
      const parentRes = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Parent comment' } } },
        { contextValue: ctx },
      );
      const parentData = (parentRes.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
      const parentId = (parentData.data?.addComment as Record<string, unknown>)?.id;

      // Add reply
      const res = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Reply!', parentCommentId: parentId } } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect((data.data?.addComment as Record<string, unknown>)?.body).toBe('Reply!');
    });

    it('should fail with empty body', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const res = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: '   ' } } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    });

    it('should fail when not authenticated', async () => {
      const { user } = await createTestUser();
      const photo = await createTestPhoto(user.id);
      const ctx = createTestContext(null);

      const res = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Hello' } } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('should fail when photo does not exist', async () => {
      const { ctx } = await createTestUser();

      const res = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: '00000000-0000-0000-0000-000000000000', body: 'Hello' } } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('updateComment', () => {
    it('should update own comment', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const addRes = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Original' } } },
        { contextValue: ctx },
      );
      const commentId = ((addRes.body as { singleResult: { data: Record<string, unknown> } }).singleResult.data?.addComment as Record<string, unknown>)?.id;

      const res = await server.executeOperation(
        { query: UPDATE_COMMENT, variables: { id: commentId, body: 'Updated!' } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect((data.data?.updateComment as Record<string, unknown>)?.body).toBe('Updated!');
    });

    it('should fail when editing another user\'s comment', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const addRes = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'My comment' } } },
        { contextValue: ctx },
      );
      const commentId = ((addRes.body as { singleResult: { data: Record<string, unknown> } }).singleResult.data?.addComment as Record<string, unknown>)?.id;

      const { ctx: otherCtx } = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser',
        cognitoSub: 'test-sub-comment-2',
      });

      const res = await server.executeOperation(
        { query: UPDATE_COMMENT, variables: { id: commentId, body: 'Hacked!' } },
        { contextValue: otherCtx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });

  describe('deleteComment', () => {
    it('should delete own comment', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const addRes = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Delete me' } } },
        { contextValue: ctx },
      );
      const commentId = ((addRes.body as { singleResult: { data: Record<string, unknown> } }).singleResult.data?.addComment as Record<string, unknown>)?.id;

      const res = await server.executeOperation(
        { query: DELETE_COMMENT, variables: { id: commentId } },
        { contextValue: ctx },
      );

      const data = (res.body as { singleResult: { data: Record<string, unknown>; errors?: unknown[] } }).singleResult;
      expect(data.errors).toBeUndefined();
      expect(data.data?.deleteComment).toBe(true);
    });

    it('should fail when deleting another user\'s comment', async () => {
      const { user, ctx } = await createTestUser();
      const photo = await createTestPhoto(user.id);

      const addRes = await server.executeOperation(
        { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'My comment' } } },
        { contextValue: ctx },
      );
      const commentId = ((addRes.body as { singleResult: { data: Record<string, unknown> } }).singleResult.data?.addComment as Record<string, unknown>)?.id;

      const { ctx: otherCtx } = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser',
        cognitoSub: 'test-sub-comment-2',
      });

      const res = await server.executeOperation(
        { query: DELETE_COMMENT, variables: { id: commentId } },
        { contextValue: otherCtx },
      );

      const data = (res.body as { singleResult: { errors?: Array<{ extensions?: { code?: string } }> } }).singleResult;
      expect(data.errors).toBeDefined();
      expect(data.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });
});

describe('comments query', () => {
  it('should return paginated top-level comments with replies', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    // Add two top-level comments
    const c1Res = await server.executeOperation(
      { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'First!' } } },
      { contextValue: ctx },
    );
    const c1Id = ((c1Res.body as { singleResult: { data: Record<string, unknown> } }).singleResult.data?.addComment as Record<string, unknown>)?.id;

    await server.executeOperation(
      { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Second!' } } },
      { contextValue: ctx },
    );

    // Add a reply to the first comment
    await server.executeOperation(
      { query: ADD_COMMENT, variables: { input: { photoId: photo.id, body: 'Reply to first', parentCommentId: c1Id } } },
      { contextValue: ctx },
    );

    const res = await server.executeOperation(
      { query: GET_COMMENTS, variables: { photoId: photo.id, first: 10 } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    const comments = data.data?.comments as {
      edges: Array<{ node: { id: string; body: string; replies: Array<{ body: string }> } }>;
      totalCount: number;
    };

    expect(comments.totalCount).toBe(2); // Only top-level
    expect(comments.edges).toHaveLength(2);
    expect(comments.edges[0].node.body).toBe('First!');
    expect(comments.edges[0].node.replies).toHaveLength(1);
    expect(comments.edges[0].node.replies[0].body).toBe('Reply to first');
    expect(comments.edges[1].node.body).toBe('Second!');
  });

  it('should return empty list for photo with no comments', async () => {
    const { user, ctx } = await createTestUser();
    const photo = await createTestPhoto(user.id);

    const res = await server.executeOperation(
      { query: GET_COMMENTS, variables: { photoId: photo.id } },
      { contextValue: ctx },
    );

    const data = (res.body as { singleResult: { data: Record<string, unknown> } }).singleResult;
    const comments = data.data?.comments as { edges: unknown[]; totalCount: number };
    expect(comments.totalCount).toBe(0);
    expect(comments.edges).toHaveLength(0);
  });
});
