import { GraphQLError } from 'graphql';

import { requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const airlineQueryResolvers = {
  airlines: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    const where: Record<string, unknown> = {};
    if (args.search) {
      where.AND = args.search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({
          OR: [
            { name: { contains: word, mode: 'insensitive' } },
            { icaoCode: { contains: word, mode: 'insensitive' } },
            { iataCode: { contains: word, mode: 'insensitive' } },
            { country: { contains: word, mode: 'insensitive' } },
          ],
        }));
    }

    if (args.after) {
      where.id = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.airline.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
      }),
      ctx.prisma.airline.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((a) => ({
      cursor: a.id,
      node: a,
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

  airline: async (_parent: unknown, args: { icaoCode: string }, ctx: Context) => {
    return ctx.prisma.airline.findFirst({
      where: { icaoCode: args.icaoCode.toUpperCase() },
    });
  },
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const airlineMutationResolvers = {
  createAirline: async (
    _parent: unknown,
    args: {
      input: {
        name: string;
        icaoCode?: string;
        iataCode?: string;
        country?: string;
        callsign?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    return ctx.prisma.airline.create({
      data: {
        name: args.input.name,
        icaoCode: args.input.icaoCode?.toUpperCase() ?? null,
        iataCode: args.input.iataCode?.toUpperCase() ?? null,
        country: args.input.country ?? null,
        callsign: args.input.callsign ?? null,
      },
    });
  },

  updateAirline: async (
    _parent: unknown,
    args: {
      id: string;
      input: {
        name?: string;
        icaoCode?: string;
        iataCode?: string;
        country?: string;
        callsign?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.airline.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Airline not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.airline.update({
      where: { id: args.id },
      data: {
        ...(args.input.name !== undefined && { name: args.input.name }),
        ...(args.input.icaoCode !== undefined && {
          icaoCode: args.input.icaoCode?.toUpperCase() ?? null,
        }),
        ...(args.input.iataCode !== undefined && {
          iataCode: args.input.iataCode?.toUpperCase() ?? null,
        }),
        ...(args.input.country !== undefined && { country: args.input.country ?? null }),
        ...(args.input.callsign !== undefined && { callsign: args.input.callsign ?? null }),
      },
    });
  },

  deleteAirline: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.airline.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Airline not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.airline.delete({ where: { id: args.id } });
    return true;
  },

  upsertAirline: async (
    _parent: unknown,
    args: {
      input: {
        name: string;
        icaoCode?: string;
        iataCode?: string;
        country?: string;
        callsign?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const icaoCode = args.input.icaoCode?.toUpperCase() ?? null;
    const iataCode = args.input.iataCode?.toUpperCase() ?? null;

    // Try to find by icaoCode (preferred), then by name
    const existing = icaoCode
      ? await ctx.prisma.airline.findUnique({ where: { icaoCode } })
      : await ctx.prisma.airline.findFirst({ where: { name: { equals: args.input.name, mode: 'insensitive' } } });

    if (existing) {
      return ctx.prisma.airline.update({
        where: { id: existing.id },
        data: {
          name: args.input.name,
          icaoCode,
          iataCode: iataCode ?? existing.iataCode,
          country: args.input.country ?? existing.country,
          callsign: args.input.callsign ?? existing.callsign,
        },
      });
    }

    return ctx.prisma.airline.create({
      data: {
        name: args.input.name,
        icaoCode,
        iataCode,
        country: args.input.country ?? null,
        callsign: args.input.callsign ?? null,
      },
    });
  },
};

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export const airlineFieldResolvers = {
  Airline: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
