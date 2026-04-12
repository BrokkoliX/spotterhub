import { GraphQLError } from 'graphql';

import { requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const aircraftQueryResolvers = {
  aircraft: async (_parent: unknown, args: { registration: string }, ctx: Context) => {
    return ctx.prisma.aircraft.findUnique({
      where: { registration: args.registration },
      include: { aircraftTypeRef: true },
    });
  },

  aircrafts: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    const where: Record<string, unknown> = {};
    if (args.search) {
      where.OR = [
        { registration: { contains: args.search, mode: 'insensitive' } },
        { aircraftType: { contains: args.search, mode: 'insensitive' } },
        { airline: { contains: args.search, mode: 'insensitive' } },
      ];
    }

    if (args.after) {
      where.registration = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.aircraft.findMany({
        where,
        orderBy: { registration: 'asc' },
        take,
        include: { aircraftTypeRef: true },
      }),
      ctx.prisma.aircraft.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((aircraft) => ({
      cursor: aircraft.registration,
      node: aircraft,
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

  aircraftTypes: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    const where: Record<string, unknown> = {};
    if (args.search) {
      // Split search into words and require each word to match at least one field
      const words = args.search.trim().split(/\s+/).filter(Boolean);
      where.AND = words.map((word) => ({
        OR: [
          { aircraftName: { contains: word, mode: 'insensitive' } },
          { manufacturer: { contains: word, mode: 'insensitive' } },
          { iataCode: { contains: word, mode: 'insensitive' } },
          { icaoCode: { contains: word, mode: 'insensitive' } },
        ],
      }));
    }

    if (args.after) {
      where.id = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.aircraftType.findMany({
        where,
        orderBy: { aircraftName: 'asc' },
        take,
      }),
      ctx.prisma.aircraftType.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((at) => ({
      cursor: at.id,
      node: at,
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

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const aircraftMutationResolvers = {
  createAircraft: async (
    _parent: unknown,
    args: {
      input: {
        registration: string;
        aircraftType: string;
        aircraftTypeId?: string;
        airline?: string;
        msn?: string;
        manufacturingDate?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const aircraft = await ctx.prisma.aircraft.create({
      data: {
        registration: args.input.registration.toUpperCase(),
        aircraftType: args.input.aircraftType,
        aircraftTypeId: args.input.aircraftTypeId ?? null,
        airline: args.input.airline,
        msn: args.input.msn,
        manufacturingDate: args.input.manufacturingDate
          ? new Date(args.input.manufacturingDate)
          : null,
      },
    });

    return aircraft;
  },

  updateAircraft: async (
    _parent: unknown,
    args: {
      id: string;
      input: {
        registration?: string;
        aircraftType?: string;
        aircraftTypeId?: string;
        airline?: string;
        msn?: string;
        manufacturingDate?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraft.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Aircraft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraft.update({
      where: { id: args.id },
      data: {
        ...(args.input.registration !== undefined && {
          registration: args.input.registration.toUpperCase(),
        }),
        ...(args.input.aircraftType !== undefined && {
          aircraftType: args.input.aircraftType,
        }),
        ...(args.input.aircraftTypeId !== undefined && {
          aircraftTypeId: args.input.aircraftTypeId ?? null,
        }),
        ...(args.input.airline !== undefined && {
          airline: args.input.airline,
        }),
        ...(args.input.msn !== undefined && {
          msn: args.input.msn,
        }),
        ...(args.input.manufacturingDate !== undefined && {
          manufacturingDate: args.input.manufacturingDate
            ? new Date(args.input.manufacturingDate)
            : null,
        }),
      },
    });
  },
};

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export interface AircraftParent {
  id: string;
  aircraftTypeId?: string | null;
  manufacturingDate?: Date | null;
}

export const aircraftFieldResolvers = {
  aircraftTypeRef: (parent: AircraftParent, _args: unknown, ctx: Context) => {
    if (!parent.aircraftTypeId) return null;
    return ctx.prisma.aircraftType.findUnique({ where: { id: parent.aircraftTypeId } });
  },

  manufacturingDate: (parent: AircraftParent) =>
    parent.manufacturingDate?.toISOString().split('T')[0] ?? null,
};
