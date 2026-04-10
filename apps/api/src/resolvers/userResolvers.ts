import type { Context } from '../context.js';
import { decodeCursor, encodeCursor } from '../utils/resolverHelpers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserParent {
  id: string;
  cognitoSub?: string;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const userQueryResolvers = {
  health: async (_parent: unknown, _args: unknown, ctx: Context) => {
    let dbConnected = false;
    try {
      await ctx.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      // DB unreachable
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbConnected,
    };
  },

  me: async (_parent: unknown, _args: unknown, ctx: Context) => {
    if (!ctx.user) return null;
    return ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      include: { profile: true },
    });
  },

  user: async (_parent: unknown, args: { username: string }, ctx: Context) => {
    const user = await ctx.prisma.user.findUnique({
      where: { username: args.username },
      include: { profile: true },
    });
    if (!user) return null;
    // If profile is private, only the owner can see it
    if (user.profile && !user.profile.isPublic) {
      if (!ctx.user || ctx.user.sub !== user.cognitoSub) {
        return null;
      }
    }
    return user;
  },

  users: async (
    _parent: unknown,
    args: { first: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);
    const where = args.after
      ? { createdAt: { lt: decodeCursor(args.after) } }
      : {};

    const [items, totalCount] = await Promise.all([
      ctx.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: { profile: true },
      }),
      ctx.prisma.user.count(),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((user) => ({
      cursor: encodeCursor(user.createdAt),
      node: user,
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

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const userFieldResolvers = {
  profile: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.profile.findUnique({
      where: { userId: parent.id },
    });
  },

  followerCount: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.userFollowerCount.load(parent.id);
  },

  followingCount: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.userFollowingCount.load(parent.id);
  },

  photoCount: (parent: UserParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.userPhotoCount.load(parent.id);
  },
};
