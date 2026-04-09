import type { Context } from '../context.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

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
      moderationStatus: { in: ['approved', 'pending'] },
      OR: [
        { caption: { contains: q, mode: 'insensitive' } },
        { aircraftType: { contains: q, mode: 'insensitive' } },
        { airline: { contains: q, mode: 'insensitive' } },
        { airportCode: { contains: q, mode: 'insensitive' } },
        { tags: { some: { tag: { contains: q, mode: 'insensitive' } } } },
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
};
