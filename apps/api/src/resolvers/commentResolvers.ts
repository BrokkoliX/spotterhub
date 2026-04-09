import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommentParent {
  id: string;
  userId: string;
}

export interface CommentsArgs {
  photoId: string;
  first?: number;
  after?: string;
}

export interface AddCommentInput {
  photoId: string;
  body: string;
  parentCommentId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

async function resolveUserId(ctx: Context): Promise<string> {
  const authUser = requireAuth(ctx);
  const user = await ctx.prisma.user.findUnique({
    where: { cognitoSub: authUser.sub },
    select: { id: true },
  });
  if (!user) {
    throw new GraphQLError('User not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  return user.id;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const commentQueryResolvers = {
  comments: async (_parent: unknown, args: CommentsArgs, ctx: Context) => {
    const take = Math.min(args.first ?? 20, 50);

    const where: Record<string, unknown> = {
      photoId: args.photoId,
      parentCommentId: null, // Only top-level comments
    };

    if (args.after) {
      where.createdAt = { gt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: take + 1,
        include: {
          user: { include: { profile: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { include: { profile: true } },
            },
          },
        },
      }),
      ctx.prisma.comment.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((comment) => ({
      cursor: encodeCursor(comment.createdAt),
      node: comment,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
      totalCount,
    };
  },
};

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const commentMutationResolvers = {
  addComment: async (
    _parent: unknown,
    args: { input: AddCommentInput },
    ctx: Context,
  ) => {
    const userId = await resolveUserId(ctx);
    const { photoId, body, parentCommentId } = args.input;

    // Validate body
    const trimmedBody = body.trim();
    if (trimmedBody.length === 0) {
      throw new GraphQLError('Comment body cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (trimmedBody.length > 2000) {
      throw new GraphQLError('Comment body cannot exceed 2000 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Verify photo exists
    const photo = await ctx.prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true },
    });
    if (!photo) {
      throw new GraphQLError('Photo not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Verify parent comment exists if replying
    if (parentCommentId) {
      const parent = await ctx.prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { id: true, photoId: true },
      });
      if (!parent) {
        throw new GraphQLError('Parent comment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      if (parent.photoId !== photoId) {
        throw new GraphQLError('Parent comment does not belong to this photo', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    return ctx.prisma.comment.create({
      data: {
        userId,
        photoId,
        body: trimmedBody,
        parentCommentId: parentCommentId ?? null,
      },
      include: {
        user: { include: { profile: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    });
  },

  updateComment: async (
    _parent: unknown,
    args: { id: string; body: string },
    ctx: Context,
  ) => {
    const userId = await resolveUserId(ctx);

    const comment = await ctx.prisma.comment.findUnique({
      where: { id: args.id },
      select: { userId: true },
    });
    if (!comment) {
      throw new GraphQLError('Comment not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    if (comment.userId !== userId) {
      throw new GraphQLError('You can only edit your own comments', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const trimmedBody = args.body.trim();
    if (trimmedBody.length === 0) {
      throw new GraphQLError('Comment body cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.comment.update({
      where: { id: args.id },
      data: { body: trimmedBody },
      include: {
        user: { include: { profile: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    });
  },

  deleteComment: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const userId = await resolveUserId(ctx);

    const comment = await ctx.prisma.comment.findUnique({
      where: { id: args.id },
      select: { userId: true },
    });
    if (!comment) {
      throw new GraphQLError('Comment not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    if (comment.userId !== userId) {
      throw new GraphQLError('You can only delete your own comments', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.comment.delete({ where: { id: args.id } });
    return true;
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const commentFieldResolvers = {
  user: (parent: CommentParent & { user?: unknown }, _args: unknown, ctx: Context) => {
    if (parent.user) return parent.user;
    return ctx.prisma.user.findUnique({
      where: { id: parent.userId },
      include: { profile: true },
    });
  },

  replies: (parent: CommentParent & { replies?: unknown[] }, _args: unknown, ctx: Context) => {
    if (parent.replies) return parent.replies;
    return ctx.prisma.comment.findMany({
      where: { parentCommentId: parent.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { include: { profile: true } },
      },
    });
  },
};
