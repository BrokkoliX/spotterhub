import { GraphQLError } from 'graphql';

import { requireRole } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Query Resolvers ──────────────────────────────────────────────────────────

export const categoryQueryResolvers = {
  photoCategories: async (_parent: unknown, _args: unknown, ctx: Context) => {
    return ctx.prisma.photoCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  },

  aircraftSpecificCategories: async (_parent: unknown, _args: unknown, ctx: Context) => {
    return ctx.prisma.aircraftSpecificCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  },
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

export const categoryMutationResolvers = {
  createPhotoCategory: async (
    _parent: unknown,
    args: { input: { name: string; label: string; sortOrder?: number } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    return ctx.prisma.photoCategory.create({
      data: {
        name: args.input.name,
        label: args.input.label,
        sortOrder: args.input.sortOrder ?? 0,
      },
    });
  },

  updatePhotoCategory: async (
    _parent: unknown,
    args: { id: string; input: { name?: string; label?: string; sortOrder?: number } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.photoCategory.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Photo category not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.photoCategory.update({
      where: { id: args.id },
      data: {
        ...(args.input.name !== undefined && { name: args.input.name }),
        ...(args.input.label !== undefined && { label: args.input.label }),
        ...(args.input.sortOrder !== undefined && { sortOrder: args.input.sortOrder }),
      },
    });
  },

  deletePhotoCategory: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.photoCategory.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Photo category not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.photoCategory.delete({ where: { id: args.id } });
    return true;
  },

  createAircraftSpecificCategory: async (
    _parent: unknown,
    args: { input: { name: string; label: string; sortOrder?: number } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    return ctx.prisma.aircraftSpecificCategory.create({
      data: {
        name: args.input.name,
        label: args.input.label,
        sortOrder: args.input.sortOrder ?? 0,
      },
    });
  },

  updateAircraftSpecificCategory: async (
    _parent: unknown,
    args: { id: string; input: { name?: string; label?: string; sortOrder?: number } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftSpecificCategory.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Aircraft specific category not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.aircraftSpecificCategory.update({
      where: { id: args.id },
      data: {
        ...(args.input.name !== undefined && { name: args.input.name }),
        ...(args.input.label !== undefined && { label: args.input.label }),
        ...(args.input.sortOrder !== undefined && { sortOrder: args.input.sortOrder }),
      },
    });
  },

  deleteAircraftSpecificCategory: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);

    const existing = await ctx.prisma.aircraftSpecificCategory.findUnique({
      where: { id: args.id },
    });
    if (!existing) {
      throw new GraphQLError('Aircraft specific category not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.aircraftSpecificCategory.delete({ where: { id: args.id } });
    return true;
  },

  upsertPhotoCategory: async (
    _parent: unknown,
    args: { input: { name: string; label: string; sortOrder?: number } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);
    return ctx.prisma.photoCategory.upsert({
      where: { name: args.input.name },
      create: { name: args.input.name, label: args.input.label, sortOrder: args.input.sortOrder ?? 0 },
      update: {
        label: args.input.label,
        ...(args.input.sortOrder !== undefined && { sortOrder: args.input.sortOrder }),
      },
    });
  },

  upsertAircraftSpecificCategory: async (
    _parent: unknown,
    args: { input: { name: string; label: string; sortOrder?: number } },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'superuser']);
    return ctx.prisma.aircraftSpecificCategory.upsert({
      where: { name: args.input.name },
      create: { name: args.input.name, label: args.input.label, sortOrder: args.input.sortOrder ?? 0 },
      update: {
        label: args.input.label,
        ...(args.input.sortOrder !== undefined && { sortOrder: args.input.sortOrder }),
      },
    });
  },
};

// ─── Field Resolvers ─────────────────────────────────────────────────────────

export const categoryFieldResolvers = {
  PhotoCategory: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },

  AircraftSpecificCategory: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
