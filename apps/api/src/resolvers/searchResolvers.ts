import type { Context } from '../context.js';
import { buildPaginationArgs, encodeCursor } from '../utils/resolverHelpers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SearchArgs {
  query: string;
  first?: number;
  after?: string;
  page?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Minimum length for free-text search queries. Below this, return an empty
 * result set without hitting the database. Prevents single-character ILIKE
 * scans that can table-scan large relations.
 */
const MIN_QUERY_LENGTH = 2;

const EMPTY_CONNECTION = {
  edges: [],
  pageInfo: { hasNextPage: false, endCursor: null },
  totalCount: 0,
} as const;

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const searchQueryResolvers = {
  searchPhotos: async (_parent: unknown, args: SearchArgs, ctx: Context) => {
    const { skip, take, cursorWhere } = buildPaginationArgs({
      first: args.first,
      after: args.after,
      page: args.page,
    });
    const q = args.query.trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return EMPTY_CONNECTION;
    }

    const where: Record<string, unknown> = {
      moderationStatus: 'approved',
      ...cursorWhere,
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

    const [items, totalCount] = await Promise.all([
      ctx.prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
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
    const { skip, take, cursorWhere } = buildPaginationArgs({
      first: args.first,
      after: args.after,
      page: args.page,
    });
    const q = args.query.trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return EMPTY_CONNECTION;
    }

    const where: Record<string, unknown> = {
      ...cursorWhere,
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { profile: { displayName: { contains: q, mode: 'insensitive' } } },
      ],
    };

    const [items, totalCount] = await Promise.all([
      ctx.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
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

    if (q.length < MIN_QUERY_LENGTH) return [];

    // Query the Airlines table directly rather than using `distinct` on the
    // photos.airline string column. This is correct (returns all known
    // airlines, not only those that appear in photos), faster (smaller
    // table, indexed on icao_code/iata_code), and removes the need to
    // post-filter nullable strings.
    const airlines = await ctx.prisma.airline.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { icaoCode: { contains: q, mode: 'insensitive' } },
          { iataCode: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { name: true },
      orderBy: { name: 'asc' },
      take,
    });

    return airlines.map((a) => a.name);
  },
};
