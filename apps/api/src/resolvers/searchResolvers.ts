import type { Context } from '../context.js';
import { decodeCursor, encodeCursor } from '../utils/resolverHelpers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SearchArgs {
  query: string;
  first?: number;
  after?: string;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const searchQueryResolvers = {
  searchPhotos: async (_parent: unknown, args: SearchArgs, ctx: Context) => {
    const take = Math.min(args.first ?? 20, 50);
    const q = args.query.trim();

    if (!q) {
      return { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 };
    }

    const where: Record<string, unknown> = {
      moderationStatus: 'approved',
      OR: [
        { caption: { contains: q, mode: 'insensitive' } },
        { airline: { contains: q, mode: 'insensitive' } },
        { airportCode: { contains: q, mode: 'insensitive' } },
        { tags: { some: { tag: { contains: q, mode: 'insensitive' } } } },
        { aircraft: { manufacturer: { name: { contains: q, mode: 'insensitive' } } } },
        { aircraft: { family: { name: { contains: q, mode: 'insensitive' } } } },
        { aircraft: { variant: { name: { contains: q, mode: 'insensitive' } } } },
        { aircraft: { registration: { contains: q, mode: 'insensitive' } } },
      ],
    };

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: { user: true, variants: true, tags: true },
      }),
      ctx.prisma.photo.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((photo) => ({
      cursor: encodeCursor(photo.createdAt),
      node: photo,
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

  searchUsers: async (_parent: unknown, args: SearchArgs, ctx: Context) => {
    const take = Math.min(args.first ?? 20, 50);
    const q = args.query.trim();

    if (!q) {
      return { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 };
    }

    const where: Record<string, unknown> = {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { profile: { displayName: { contains: q, mode: 'insensitive' } } },
      ],
    };

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: { profile: true },
      }),
      ctx.prisma.user.count({ where }),
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

  searchAirlines: async (
    _parent: unknown,
    args: { query: string; first?: number },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 10, 20);
    const q = args.query.trim();

    if (!q) return [];

    const airlines = await ctx.prisma.photo.findMany({
      where: {
        airline: { contains: q, mode: 'insensitive' },
        moderationStatus: 'approved',
      },
      select: { airline: true },
      distinct: ['airline'],
      orderBy: { airline: 'asc' },
      take,
    });

    return airlines.map((a) => a.airline).filter((s): s is string => !!s);
  },
};
