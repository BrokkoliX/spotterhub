import { GraphQLError } from 'graphql';
import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, getDbUser } from '../utils/resolverHelpers.js';

// Reuse roleWeight from communityResolvers — keep in sync
function roleWeight(role: string): number {
  const weights: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };
  return weights[role] ?? 0;
}

async function getMembership(ctx: Context, communityId: string, userId: string) {
  return ctx.prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
}

// ─── Query Resolvers ─────────────────────────────────────────────────────────

export const communityModerationQueryResolvers = {
  communityModerationLogs: async (
    _parent: unknown,
    args: { communityId: string; action?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const membership = await getMembership(ctx, args.communityId, dbUser.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new GraphQLError('Only community owners and admins can view the moderation log', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const take = Math.min(args.first ?? 20, 50);
    const where: Record<string, unknown> = { communityId: args.communityId };
    if (args.action) where.action = args.action;
    if (args.after) where.createdAt = { lt: decodeCursor(args.after) };

    const [items, totalCount] = await Promise.all([
      ctx.prisma.communityModerationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: { moderator: true, targetUser: true },
      }),
      ctx.prisma.communityModerationLog.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((log) => ({
      cursor: encodeCursor(log.createdAt),
      node: log,
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

// ─── Mutation Resolvers ──────────────────────────────────────────────────────

export const communityModerationMutationResolvers = {
  banCommunityMember: async (
    _parent: unknown,
    args: { communityId: string; userId: string; reason?: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const callerMembership = await getMembership(ctx, args.communityId, dbUser.id);
    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      throw new GraphQLError('Only community owners and admins can ban members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const targetMembership = await getMembership(ctx, args.communityId, args.userId);
    if (!targetMembership) {
      throw new GraphQLError('User is not a member of this community', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (targetMembership.userId === dbUser.id) {
      throw new GraphQLError('You cannot ban yourself', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (roleWeight(targetMembership.role) >= roleWeight(callerMembership.role)) {
      throw new GraphQLError('Cannot ban a member with equal or higher role', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (targetMembership.status === 'banned') {
      throw new GraphQLError('User is already banned', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const result = await ctx.prisma.$transaction(async (tx) => {
      const updated = await tx.communityMember.update({
        where: { id: targetMembership.id },
        data: { status: 'banned' },
      });

      await tx.communityModerationLog.create({
        data: {
          communityId: args.communityId,
          moderatorId: dbUser.id,
          targetUserId: args.userId,
          action: 'ban',
          reason: args.reason ?? null,
        },
      });

      return updated;
    });

    return result;
  },

  unbanCommunityMember: async (
    _parent: unknown,
    args: { communityId: string; userId: string },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const callerMembership = await getMembership(ctx, args.communityId, dbUser.id);
    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      throw new GraphQLError('Only community owners and admins can unban members', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const targetMembership = await getMembership(ctx, args.communityId, args.userId);
    if (!targetMembership) {
      throw new GraphQLError('User is not a member of this community', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (targetMembership.status !== 'banned') {
      throw new GraphQLError('User is not banned', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const result = await ctx.prisma.$transaction(async (tx) => {
      const updated = await tx.communityMember.update({
        where: { id: targetMembership.id },
        data: { status: 'active' },
      });

      await tx.communityModerationLog.create({
        data: {
          communityId: args.communityId,
          moderatorId: dbUser.id,
          targetUserId: args.userId,
          action: 'unban',
        },
      });

      return updated;
    });

    return result;
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const communityModerationLogFieldResolvers = {
  community: (parent: { communityId: string }, _args: unknown, ctx: Context) => {
    return ctx.prisma.community.findUnique({ where: { id: parent.communityId } });
  },
  moderator: (parent: { moderatorId: string }, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({ where: { id: parent.moderatorId } });
  },
  targetUser: (parent: { targetUserId: string }, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({ where: { id: parent.targetUserId } });
  },
};