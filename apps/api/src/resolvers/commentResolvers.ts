import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, getDbUser, resolveUserId } from '../utils/resolverHelpers.js';
import { validateStringLength } from '../utils/validation.js';

import { createNotification } from './notificationResolvers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommentParent {
  id: string;
  userId: string;
  isDeleted?: boolean;
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

/**
 * Returns a Prisma filter to exclude soft-deleted records for non-privileged users.
 */
async function deletedFilter(ctx: Context): Promise<Record<string, unknown>> {
  try {
    const authUser = requireAuth(ctx);
    const dbUser = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { role: true },
    });
    if (dbUser && ['admin', 'moderator', 'superuser'].includes(dbUser.role)) {
      return {};
    }
  } catch {
    // Not authenticated
  }
  return { isDeleted: false };
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const commentQueryResolvers = {
  comments: async (_parent: unknown, args: CommentsArgs, ctx: Context) => {
    const take = Math.min(args.first ?? 20, 50);
    const filter = await deletedFilter(ctx);

    const where: Record<string, unknown> = {
      photoId: args.photoId,
      parentCommentId: null, // Only top-level comments
      ...filter,
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
  addComment: async (_parent: unknown, args: { input: AddCommentInput }, ctx: Context) => {
    const userId = await resolveUserId(ctx);
    const { photoId, body, parentCommentId } = args.input;
    validateStringLength(body, 'Comment body', 1, 2000);

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
      select: { id: true, userId: true },
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

    const comment = await ctx.prisma.comment.create({
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

    // Notify the photo owner (skip self-comments)
    if (photo.userId !== userId) {
      const commenter = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (commenter) {
        createNotification(ctx.prisma, {
          userId: photo.userId,
          type: 'comment',
          title: '💬 New comment',
          body: `@${commenter.username} commented on your photo`,
          data: { photoId, commentId: comment.id },
        }).catch(() => {});
      }
    }

    return comment;
  },

  updateComment: async (_parent: unknown, args: { id: string; body: string }, ctx: Context) => {
    const userId = await resolveUserId(ctx);
    validateStringLength(args.body, 'Comment body', 1, 2000);

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

  deleteComment: async (_parent: unknown, args: { id: string }, ctx: Context) => {
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

  softDeleteComment: async (
    _parent: unknown,
    args: { id: string; reason?: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    if (!['admin', 'moderator', 'superuser'].includes(dbUser.role)) {
      throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    }

    const comment = await ctx.prisma.comment.findUnique({ where: { id: args.id } });
    if (!comment) {
      throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
    }

    await ctx.prisma.communityModerationLog.create({
      data: {
        communityId: 'global',
        moderatorId: dbUser.id,
        targetUserId: comment.userId,
        action: 'delete_comment',
        reason: args.reason ?? 'Soft delete requested',
        metadata: { commentId: comment.id, mode: 'SOFT' },
      },
    });

    await ctx.prisma.comment.update({
      where: { id: args.id },
      data: { isDeleted: true, body: '[deleted]' },
    });
    return true;
  },

  hardDeleteComment: async (
    _parent: unknown,
    args: { id: string; reason: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    if (!['admin', 'moderator', 'superuser'].includes(dbUser.role)) {
      throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    }

    if (!args.reason) {
      throw new GraphQLError('A reason is required for hard deletion', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const comment = await ctx.prisma.comment.findUnique({ where: { id: args.id } });
    if (!comment) {
      throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
    }

    await ctx.prisma.communityModerationLog.create({
      data: {
        communityId: 'global',
        moderatorId: dbUser.id,
        targetUserId: comment.userId,
        action: 'delete_comment',
        reason: args.reason,
        metadata: { commentId: comment.id, mode: 'HARD' },
      },
    });

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
      take: 50, // Limit to 50 to prevent memory exhaustion
      include: {
        user: { include: { profile: true } },
      },
    });
  },
};
