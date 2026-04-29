import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';
import { validateStringLength } from '../utils/validation.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateReportInput {
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_TARGET_TYPES = [
  'photo',
  'comment',
  'profile',
  'album',
  'community',
  'forum_post',
];
const VALID_REASONS = [
  'inappropriate',
  'spam',
  'harassment',
  'copyright',
  'other',
];

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const reportMutationResolvers = {
  createReport: async (_parent: unknown, args: { input: CreateReportInput }, ctx: Context) => {
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

    const { targetType, targetId, reason, description } = args.input;
    validateStringLength(args.input.description, 'Description', 0, 2000);

    // Validate targetType
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      throw new GraphQLError(
        `Invalid target type. Must be one of: ${VALID_TARGET_TYPES.join(', ')}`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    // Validate reason
    if (!VALID_REASONS.includes(reason)) {
      throw new GraphQLError(`Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate description for 'other' reason
    if (reason === 'other' && (!description || description.trim().length === 0)) {
      throw new GraphQLError('Description is required when reason is "other"', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Verify target exists
    if (targetType === 'photo') {
      const target = await ctx.prisma.photo.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) {
        throw new GraphQLError('Photo not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    } else if (targetType === 'comment') {
      const target = await ctx.prisma.comment.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) {
        throw new GraphQLError('Comment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    } else if (targetType === 'profile') {
      const target = await ctx.prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    } else if (targetType === 'album') {
      const target = await ctx.prisma.album.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) {
        throw new GraphQLError('Album not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    } else if (targetType === 'community') {
      const target = await ctx.prisma.community.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) {
        throw new GraphQLError('Community not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    } else if (targetType === 'forum_post') {
      const target = await ctx.prisma.forumPost.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) {
        throw new GraphQLError('Forum post not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    }

    // Check for duplicate report
    const existingReport = await ctx.prisma.report.findFirst({
      where: {
        reporterId: user.id,
        targetType: targetType as 'photo' | 'comment' | 'profile' | 'album' | 'community' | 'forum_post',
        targetId,
        status: { in: ['open', 'reviewed'] },
      },
    });
    if (existingReport) {
      throw new GraphQLError('You have already reported this content', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const report = await ctx.prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: targetType as 'photo' | 'comment' | 'profile' | 'album' | 'community' | 'forum_post',
        targetId,
        reason: reason as 'inappropriate' | 'spam' | 'harassment' | 'copyright' | 'other',
        description: description?.trim() || null,
      },
      include: { reporter: true },
    });

    return report;
  },
};
