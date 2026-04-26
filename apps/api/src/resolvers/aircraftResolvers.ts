import { GraphQLError } from 'graphql';

import { requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const aircraftQueryResolvers = {
  aircraft: async (_parent: unknown, args: { registration: string }, ctx: Context) => {
    return ctx.prisma.aircraft.findUnique({
      where: { registration: args.registration },
    });
  },

  aircraftSearch: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    const where: Record<string, unknown> = {};
    if (args.search) {
      where.OR = [
        { registration: { contains: args.search, mode: 'insensitive' } },
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

  adminAircraft: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const take = Math.min(args.first ?? 50, 100);
    const where: Record<string, unknown> = {};

    if (args.search) {
      const words = args.search.trim().split(/\s+/).filter(Boolean);
      where.AND = words.map((word) => ({
        OR: [
          { registration: { contains: word, mode: 'insensitive' } },
          { airline: { contains: word, mode: 'insensitive' } },
          { manufacturer: { name: { contains: word, mode: 'insensitive' } } },
          { family: { name: { contains: word, mode: 'insensitive' } } },
          { variant: { name: { contains: word, mode: 'insensitive' } } },
        ],
      }));
    }

    if (args.after) {
      where.registration = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.aircraft.findMany({
        where,
        orderBy: { registration: 'asc' },
        take,
        include: {
          manufacturer: true,
          family: true,
          variant: true,
          airlineRef: true,
        },
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
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const aircraftMutationResolvers = {
  createAircraft: async (
    _parent: unknown,
    args: {
      input: {
        registration: string;
        airline?: string;
        msn?: string;
        manufacturingDate?: string;
        manufacturerId?: string;
        familyId?: string;
        variantId?: string;
        operatorType?: string;
        airlineId?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const aircraft = await ctx.prisma.aircraft.create({
      data: {
        registration: args.input.registration.toUpperCase(),
        airline: args.input.airline,
        msn: args.input.msn,
        manufacturingDate: args.input.manufacturingDate
          ? new Date(args.input.manufacturingDate)
          : null,
        manufacturerId: args.input.manufacturerId ?? null,
        familyId: args.input.familyId ?? null,
        variantId: args.input.variantId ?? null,
        operatorType: args.input.operatorType
          ? (args.input.operatorType.toLowerCase() as
              | 'airline'
              | 'general_aviation'
              | 'military'
              | 'government'
              | 'cargo'
              | 'charter'
              | 'private')
          : null,
        airlineId: args.input.airlineId ?? null,
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
        airline?: string;
        msn?: string;
        manufacturingDate?: string;
        manufacturerId?: string;
        familyId?: string;
        variantId?: string;
        operatorType?: string;
        airlineId?: string;
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

    const data: Record<string, unknown> = {};
    if (args.input.registration !== undefined)
      data.registration = args.input.registration.toUpperCase();
    if (args.input.airline !== undefined) data.airline = args.input.airline;
    if (args.input.msn !== undefined) data.msn = args.input.msn;
    if (args.input.manufacturingDate !== undefined)
      data.manufacturingDate = args.input.manufacturingDate
        ? new Date(args.input.manufacturingDate)
        : null;
    if (args.input.manufacturerId !== undefined)
      data.manufacturerId = args.input.manufacturerId ?? null;
    if (args.input.familyId !== undefined) data.familyId = args.input.familyId ?? null;
    if (args.input.variantId !== undefined) data.variantId = args.input.variantId ?? null;
    if (args.input.operatorType !== undefined)
      data.operatorType = args.input.operatorType
        ? (args.input.operatorType.toLowerCase() as
            | 'airline'
            | 'general_aviation'
            | 'military'
            | 'government'
            | 'cargo'
            | 'charter'
            | 'private')
        : null;
    if (args.input.airlineId !== undefined) data.airlineId = args.input.airlineId ?? null;

    return ctx.prisma.aircraft.update({
      where: { id: args.id },
      data: data as Parameters<typeof ctx.prisma.aircraft.update>[0]['data'],
    });
  },

  upsertAircraft: async (
    _parent: unknown,
    args: {
      input: {
        registration: string;
        airline?: string;
        msn?: string;
        manufacturingDate?: string;
        manufacturerId?: string;
        familyId?: string;
        variantId?: string;
        operatorType?: string;
        airlineId?: string;
      };
    },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const registration = args.input.registration.toUpperCase();
    const existing = await ctx.prisma.aircraft.findUnique({
      where: { registration },
    });

    const data = {
      airline: args.input.airline,
      msn: args.input.msn,
      manufacturingDate: args.input.manufacturingDate
        ? new Date(args.input.manufacturingDate)
        : null,
      manufacturerId: args.input.manufacturerId ?? null,
      familyId: args.input.familyId ?? null,
      variantId: args.input.variantId ?? null,
      operatorType: args.input.operatorType
        ? (args.input.operatorType.toLowerCase() as
            | 'airline'
            | 'general_aviation'
            | 'military'
            | 'government'
            | 'cargo'
            | 'charter'
            | 'private')
        : null,
      airlineId: args.input.airlineId ?? null,
    };

    if (existing) {
      return ctx.prisma.aircraft.update({
        where: { id: existing.id },
        data,
      });
    }

    return ctx.prisma.aircraft.create({
      data: {
        registration,
        ...data,
      },
    });
  },

  deleteAircraft: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraft.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Aircraft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraft.delete({ where: { id: args.id } });
    return true;
  },

  createPendingAircraft: async (
    _parent: unknown,
    args: {
      input: {
        registration: string;
        airline?: string;
        msn?: string;
        manufacturingDate?: string;
        manufacturerId?: string;
        familyId?: string;
        variantId?: string;
        operatorType?: string;
        airlineId?: string;
      };
    },
    ctx: Context,
  ) => {
    if (!ctx.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const registration = args.input.registration.toUpperCase();

    // Check if aircraft already exists (active or pending)
    const existing = await ctx.prisma.aircraft.findUnique({
      where: { registration },
    });
    if (existing) {
      throw new GraphQLError('Aircraft with this registration already exists', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.aircraft.create({
      data: {
        registration,
        airline: args.input.airline,
        msn: args.input.msn,
        manufacturingDate: args.input.manufacturingDate
          ? new Date(args.input.manufacturingDate)
          : null,
        manufacturerId: args.input.manufacturerId ?? null,
        familyId: args.input.familyId ?? null,
        variantId: args.input.variantId ?? null,
        operatorType: args.input.operatorType
          ? (args.input.operatorType.toLowerCase() as
              | 'airline'
              | 'general_aviation'
              | 'military'
              | 'government'
              | 'cargo'
              | 'charter'
              | 'private')
          : null,
        airlineId: args.input.airlineId ?? null,
        status: 'pending_approval',
      },
    });
  },

  approveAircraft: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'moderator', 'superuser']);

    const aircraft = await ctx.prisma.aircraft.findUnique({
      where: { id: args.id },
    });
    if (!aircraft) {
      throw new GraphQLError('Aircraft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Update status to active
    const updated = await ctx.prisma.aircraft.update({
      where: { id: args.id },
      data: { status: 'active' },
    });

    // Link any photos that have matching operatorIcao but no aircraftId
    // (photos submitted with this aircraft before it was approved)
    if (aircraft.airline) {
      await ctx.prisma.photo.updateMany({
        where: {
          operatorIcao: aircraft.airline,
          aircraftId: null,
        },
        data: {
          aircraftId: aircraft.id,
        },
      });
    }

    return updated;
  },

  rejectAircraft: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const aircraft = await ctx.prisma.aircraft.findUnique({
      where: { id: args.id },
    });
    if (!aircraft) {
      throw new GraphQLError('Aircraft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraft.delete({ where: { id: args.id } });
    return true;
  },
};

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export interface AircraftParent {
  id: string;
  registration: string;
  manufacturingDate?: Date | null;
  manufacturerId?: string | null;
  familyId?: string | null;
  variantId?: string | null;
  airlineId?: string | null;
  operatorType?: string | null;
}

export const aircraftFieldResolvers = {
  manufacturingDate: (parent: AircraftParent) =>
    parent.manufacturingDate?.toISOString().split('T')[0] ?? null,

  operatorType: (parent: AircraftParent) =>
    parent.operatorType
      ? (parent.operatorType.toUpperCase() as
          | 'AIRLINE'
          | 'GENERAL_AVIATION'
          | 'MILITARY'
          | 'GOVERNMENT'
          | 'CARGO'
          | 'CHARTER'
          | 'PRIVATE')
      : null,

  manufacturer: (parent: AircraftParent, _args: unknown, ctx: Context) => {
    if (!parent.manufacturerId) return null;
    return ctx.prisma.aircraftManufacturer.findUnique({ where: { id: parent.manufacturerId } });
  },

  family: (parent: AircraftParent, _args: unknown, ctx: Context) => {
    if (!parent.familyId) return null;
    return ctx.prisma.aircraftFamily.findUnique({ where: { id: parent.familyId } });
  },

  variant: (parent: AircraftParent, _args: unknown, ctx: Context) => {
    if (!parent.variantId) return null;
    return ctx.prisma.aircraftVariant.findUnique({ where: { id: parent.variantId } });
  },

  airlineRef: (parent: AircraftParent, _args: unknown, ctx: Context) => {
    if (!parent.airlineId) return null;
    return ctx.prisma.airline.findUnique({ where: { id: parent.airlineId } });
  },

  isFollowedByMe: async (parent: AircraftParent, _args: unknown, ctx: Context) => {
    if (!ctx.user) return false;

    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!user) return false;

    const follow = await ctx.prisma.follow.findUnique({
      where: {
        followerId_targetType_targetValue: {
          followerId: user.id,
          targetType: 'registration',
          targetValue: parent.registration,
        },
      },
      select: { id: true },
    });
    return !!follow;
  },
};
