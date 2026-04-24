import { GraphQLError } from 'graphql';

import { requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const aircraftHierarchyQueryResolvers = {
  aircraftManufacturers: async (
    _parent: unknown,
    args: { search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 10000);

    const where: Record<string, unknown> = {};
    if (args.search) {
      where.AND = args.search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({
          OR: [
            { name: { contains: word, mode: 'insensitive' } },
            { country: { contains: word, mode: 'insensitive' } },
          ],
        }));
    }

    if (args.after) {
      where.id = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.aircraftManufacturer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: take + 1,
      }),
      ctx.prisma.aircraftManufacturer.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((m) => ({
      cursor: m.id,
      node: m,
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

  aircraftFamilies: async (
    _parent: unknown,
    args: { manufacturerId?: string; search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 10000);

    const where: Record<string, unknown> = {};
    if (args.manufacturerId) {
      where.manufacturerId = args.manufacturerId;
    }
    if (args.search) {
      where.AND = args.search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({
          name: { contains: word, mode: 'insensitive' },
        }));
    }

    if (args.after) {
      where.id = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.aircraftFamily.findMany({
        where,
        orderBy: { name: 'asc' },
        take: take + 1,
        include: { manufacturer: true, variants: true },
      }),
      ctx.prisma.aircraftFamily.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((f) => ({
      cursor: f.id,
      node: f,
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

  aircraftVariants: async (
    _parent: unknown,
    args: { familyId?: string; search?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 10000);

    const where: Record<string, unknown> = {};
    if (args.familyId) {
      where.familyId = args.familyId;
    }
    if (args.search) {
      where.AND = args.search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({
          name: { contains: word, mode: 'insensitive' },
        }));
    }

    if (args.after) {
      where.id = { gt: args.after };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.aircraftVariant.findMany({
        where,
        orderBy: { name: 'asc' },
        take: take + 1,
        include: { family: { include: { manufacturer: true } } },
      }),
      ctx.prisma.aircraftVariant.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((v) => ({
      cursor: v.id,
      node: v,
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

export const aircraftHierarchyMutationResolvers = {
  createManufacturer: async (
    _parent: unknown,
    args: { input: { name: string; country?: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);
    return ctx.prisma.aircraftManufacturer.create({
      data: {
        name: args.input.name,
        country: args.input.country ?? null,
      },
    });
  },

  updateManufacturer: async (
    _parent: unknown,
    args: { id: string; input: { name?: string; country?: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftManufacturer.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Manufacturer not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftManufacturer.update({
      where: { id: args.id },
      data: {
        ...(args.input.name !== undefined && { name: args.input.name }),
        ...(args.input.country !== undefined && { country: args.input.country ?? null }),
      },
    });
  },

  deleteManufacturer: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftManufacturer.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Manufacturer not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraftManufacturer.delete({ where: { id: args.id } });
    return true;
  },

  createFamily: async (
    _parent: unknown,
    args: { input: { name: string; manufacturerId: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const manufacturer = await ctx.prisma.aircraftManufacturer.findUnique({
      where: { id: args.input.manufacturerId },
    });
    if (!manufacturer) {
      throw new GraphQLError('Manufacturer not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftFamily.create({
      data: {
        name: args.input.name,
        manufacturerId: args.input.manufacturerId,
      },
      include: { manufacturer: true, variants: true },
    });
  },

  updateFamily: async (
    _parent: unknown,
    args: { id: string; input: { name?: string; manufacturerId?: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftFamily.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Family not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (args.input.manufacturerId) {
      const manufacturer = await ctx.prisma.aircraftManufacturer.findUnique({
        where: { id: args.input.manufacturerId },
      });
      if (!manufacturer) {
        throw new GraphQLError('Manufacturer not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    }

    return ctx.prisma.aircraftFamily.update({
      where: { id: args.id },
      data: {
        ...(args.input.name !== undefined && { name: args.input.name }),
        ...(args.input.manufacturerId !== undefined && {
          manufacturerId: args.input.manufacturerId,
        }),
      },
      include: { manufacturer: true, variants: true },
    });
  },

  deleteFamily: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftFamily.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Family not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraftFamily.delete({ where: { id: args.id } });
    return true;
  },

  createVariant: async (
    _parent: unknown,
    args: { input: { name: string; familyId: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const family = await ctx.prisma.aircraftFamily.findUnique({
      where: { id: args.input.familyId },
    });
    if (!family) {
      throw new GraphQLError('Family not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftVariant.create({
      data: {
        name: args.input.name,
        familyId: args.input.familyId,
      },
      include: { family: { include: { manufacturer: true } } },
    });
  },

  updateVariant: async (
    _parent: unknown,
    args: { id: string; input: { name?: string; familyId?: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftVariant.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Variant not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (args.input.familyId) {
      const family = await ctx.prisma.aircraftFamily.findUnique({
        where: { id: args.input.familyId },
      });
      if (!family) {
        throw new GraphQLError('Family not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    }

    return ctx.prisma.aircraftVariant.update({
      where: { id: args.id },
      data: {
        ...(args.input.name !== undefined && { name: args.input.name }),
        ...(args.input.familyId !== undefined && { familyId: args.input.familyId }),
      },
      include: { family: { include: { manufacturer: true } } },
    });
  },

  deleteVariant: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftVariant.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Variant not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraftVariant.delete({ where: { id: args.id } });
    return true;
  },

  upsertManufacturer: async (
    _parent: unknown,
    args: { input: { name: string; country?: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);
    return ctx.prisma.aircraftManufacturer.upsert({
      where: { name: args.input.name },
      create: { name: args.input.name, country: args.input.country ?? null },
      update: {
        ...(args.input.country !== undefined && { country: args.input.country ?? null }),
      },
    });
  },

  upsertFamily: async (
    _parent: unknown,
    args: { input: { name: string; manufacturerId: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const manufacturer = await ctx.prisma.aircraftManufacturer.findUnique({
      where: { id: args.input.manufacturerId },
    });
    if (!manufacturer) {
      throw new GraphQLError('Manufacturer not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftFamily.upsert({
      where: { name: args.input.name },
      create: { name: args.input.name, manufacturerId: args.input.manufacturerId },
      update: { manufacturerId: args.input.manufacturerId },
      include: { manufacturer: true, variants: true },
    });
  },

  upsertVariant: async (
    _parent: unknown,
    args: { input: { name: string; familyId: string } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const family = await ctx.prisma.aircraftFamily.findUnique({
      where: { id: args.input.familyId },
    });
    if (!family) {
      throw new GraphQLError('Family not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftVariant.upsert({
      where: { name: args.input.name },
      create: {
        name: args.input.name,
        familyId: args.input.familyId,
      },
      update: {
        familyId: args.input.familyId,
      },
      include: { family: { include: { manufacturer: true } } },
    });
  },
};

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export const aircraftHierarchyFieldResolvers = {
  AircraftManufacturer: {
    families: (parent: { id: string }, _args: unknown, ctx: Context) => {
      return ctx.prisma.aircraftFamily.findMany({
        where: { manufacturerId: parent.id },
        orderBy: { name: 'asc' },
      });
    },
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    isFollowedByMe: async (parent: { name: string }, _args: unknown, ctx: Context) => {
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
            targetType: 'manufacturer',
            targetValue: parent.name,
          },
        },
        select: { id: true },
      });
      return !!follow;
    },
  },

  AircraftFamily: {
    manufacturer: (parent: { manufacturerId: string }, _args: unknown, ctx: Context) => {
      return ctx.prisma.aircraftManufacturer.findUnique({
        where: { id: parent.manufacturerId },
      });
    },
    variants: (parent: { id: string }, _args: unknown, ctx: Context) => {
      return ctx.prisma.aircraftVariant.findMany({
        where: { familyId: parent.id },
        orderBy: { name: 'asc' },
      });
    },
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    isFollowedByMe: async (parent: { name: string }, _args: unknown, ctx: Context) => {
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
            targetType: 'family',
            targetValue: parent.name,
          },
        },
        select: { id: true },
      });
      return !!follow;
    },
  },

  AircraftVariant: {
    family: (parent: { familyId: string }, _args: unknown, ctx: Context) => {
      return ctx.prisma.aircraftFamily.findUnique({
        where: { id: parent.familyId },
        include: { manufacturer: true },
      });
    },
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    isFollowedByMe: async (parent: { name: string }, _args: unknown, ctx: Context) => {
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
            targetType: 'variant',
            targetValue: parent.name,
          },
        },
        select: { id: true },
      });
      return !!follow;
    },
  },
};
