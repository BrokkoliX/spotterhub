import { GraphQLError } from 'graphql';

import { requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const aircraftQueryResolvers = {
  exportAircraftTypes: async (_parent: unknown, _args: unknown, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);
    return ctx.prisma.aircraftType.findMany({
      orderBy: { model: 'asc' },
    });
  },

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

  adminAircraftTypes: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'moderator']);

    const take = Math.min(args.first ?? 50, 100);
    const where: Record<string, unknown> = {};

    if (args.search) {
      const words = args.search.trim().split(/\s+/).filter(Boolean);
      where.AND = words.map((word) => ({
        OR: [
          { model: { contains: word, mode: 'insensitive' } },
          { vendor: { contains: word, mode: 'insensitive' } },
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
        orderBy: { model: 'asc' },
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
          { model: { contains: word, mode: 'insensitive' } },
          { vendor: { contains: word, mode: 'insensitive' } },
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
        orderBy: { model: 'asc' },
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

  deleteAircraftType: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftType.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Aircraft type not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraftType.delete({ where: { id: args.id } });
    return true;
  },

  createAircraftType: async (
    _parent: unknown,
    args: {
      input: {
        iataCode?: string;
        icaoCode: string;
        vendor: string;
        model: string;
        category?: string;
        engineType?: string;
        engineCount?: number;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    return ctx.prisma.aircraftType.create({
      data: {
        iataCode: args.input.iataCode || null,
        icaoCode: args.input.icaoCode.toUpperCase(),
        vendor: args.input.vendor,
        model: args.input.model,
        category: args.input.category || null,
        engineType: args.input.engineType || null,
        engineCount: args.input.engineCount ?? null,
      },
    });
  },

  updateAircraftType: async (
    _parent: unknown,
    args: {
      id: string;
      input: {
        iataCode?: string;
        icaoCode?: string;
        vendor?: string;
        model?: string;
        category?: string;
        engineType?: string;
        engineCount?: number;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftType.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Aircraft type not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftType.update({
      where: { id: args.id },
      data: {
        ...(args.input.iataCode !== undefined && {
          iataCode: args.input.iataCode || null,
        }),
        ...(args.input.icaoCode !== undefined && {
          icaoCode: args.input.icaoCode.toUpperCase(),
        }),
        ...(args.input.vendor !== undefined && { vendor: args.input.vendor }),
        ...(args.input.model !== undefined && { model: args.input.model }),
        ...(args.input.category !== undefined && {
          category: args.input.category || null,
        }),
        ...(args.input.engineType !== undefined && {
          engineType: args.input.engineType || null,
        }),
        ...(args.input.engineCount !== undefined && {
          engineCount: args.input.engineCount ?? null,
        }),
      },
    });
  },

  upsertAircraftType: async (
    _parent: unknown,
    args: {
      input: {
        iataCode?: string;
        icaoCode: string;
        vendor: string;
        model: string;
        category?: string;
        engineType?: string;
        engineCount?: number;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const icao = args.input.icaoCode.toUpperCase();
    const existing = await ctx.prisma.aircraftType.findFirst({
      where: { icaoCode: icao },
    });

    if (existing) {
      return ctx.prisma.aircraftType.update({
        where: { id: existing.id },
        data: {
          iataCode: args.input.iataCode || null,
          vendor: args.input.vendor,
          model: args.input.model,
          category: args.input.category || null,
          engineType: args.input.engineType || null,
          engineCount: args.input.engineCount ?? null,
        },
      });
    }

    return ctx.prisma.aircraftType.create({
      data: {
        iataCode: args.input.iataCode || null,
        icaoCode: icao,
        vendor: args.input.vendor,
        model: args.input.model,
        category: args.input.category || null,
        engineType: args.input.engineType || null,
        engineCount: args.input.engineCount ?? null,
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
