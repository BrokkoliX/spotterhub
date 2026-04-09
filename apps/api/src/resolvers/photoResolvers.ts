import { validateUpload } from '@spotterhub/shared';
import { GraphQLError } from 'graphql';


import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';
import { generateVariants } from '../services/imageProcessing.js';
import { getObjectUrl, getPresignedUploadUrl } from '../services/s3.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhotosArgs {
  first?: number;
  after?: string;
  userId?: string;
  albumId?: string;
  aircraftType?: string;
  airportCode?: string;
  tags?: string[];
}

export interface CreatePhotoInput {
  s3Key: string;
  mimeType: string;
  fileSizeBytes: number;
  caption?: string;
  aircraftType?: string;
  airline?: string;
  airportCode?: string;
  takenAt?: string;
  tags?: string[];
}

export interface UpdatePhotoInput {
  caption?: string;
  aircraftType?: string;
  airline?: string;
  airportCode?: string;
  takenAt?: string;
  tags?: string[];
}

export interface PhotoParent {
  id: string;
  userId: string;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const photoQueryResolvers = {
  photo: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    return ctx.prisma.photo.findUnique({
      where: { id: args.id },
      include: { user: true, variants: true, tags: true },
    });
  },

  photos: async (_parent: unknown, args: PhotosArgs, ctx: Context) => {
    const take = Math.min(args.first ?? 20, 50);

    // Build filter conditions
    const where: Record<string, unknown> = {
      moderationStatus: { in: ['approved', 'pending'] },
    };

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }
    if (args.userId) {
      where.userId = args.userId;
    }
    if (args.albumId) {
      where.albumId = args.albumId;
    }
    if (args.aircraftType) {
      where.aircraftType = { contains: args.aircraftType, mode: 'insensitive' };
    }
    if (args.airportCode) {
      where.airportCode = { equals: args.airportCode, mode: 'insensitive' };
    }
    if (args.tags && args.tags.length > 0) {
      where.tags = {
        some: { tag: { in: args.tags } },
      };
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
};

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const photoMutationResolvers = {
  getUploadUrl: async (
    _parent: unknown,
    args: { input: { mimeType: string; fileSizeBytes: number } },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Validate file type and size against tier limits (default to 'free')
    const uploadError = validateUpload(args.input.fileSizeBytes, args.input.mimeType, 'free');
    if (uploadError) {
      throw new GraphQLError(uploadError, { extensions: { code: 'BAD_USER_INPUT' } });
    }

    return getPresignedUploadUrl(user.id, args.input.mimeType);
  },

  createPhoto: async (
    _parent: unknown,
    args: { input: CreatePhotoInput },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const { input } = args;
    const originalUrl = getObjectUrl(input.s3Key);

    // Create the photo record
    const photo = await ctx.prisma.photo.create({
      data: {
        userId: user.id,
        caption: input.caption,
        aircraftType: input.aircraftType,
        airline: input.airline,
        airportCode: input.airportCode,
        takenAt: input.takenAt ? new Date(input.takenAt) : null,
        originalUrl,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        // In dev, auto-approve; in production, start as pending
        moderationStatus: process.env.NODE_ENV === 'production' ? 'pending' : 'approved',
        tags: input.tags
          ? { create: input.tags.map((tag) => ({ tag: tag.toLowerCase().trim() })) }
          : undefined,
      },
      include: { user: true, variants: true, tags: true },
    });

    // Generate image variants asynchronously (in dev, synchronous for simplicity)
    try {
      const variants = await generateVariants(input.s3Key);
      for (const variant of variants) {
        await ctx.prisma.photoVariant.create({
          data: {
            photoId: photo.id,
            variantType: variant.variantType,
            url: variant.url,
            width: variant.width,
            height: variant.height,
            fileSizeBytes: variant.fileSizeBytes,
          },
        });
      }

      // Update original dimensions from the first variant's source
      if (variants.length > 0) {
        // Re-fetch to get updated variants
        return ctx.prisma.photo.findUnique({
          where: { id: photo.id },
          include: { user: true, variants: true, tags: true },
        });
      }
    } catch (err) {
      // Log but don't fail — photo is created, variants can be retried
      console.error('Variant generation failed:', err);
    }

    return photo;
  },

  updatePhoto: async (
    _parent: unknown,
    args: { id: string; input: UpdatePhotoInput },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const photo = await ctx.prisma.photo.findUnique({
      where: { id: args.id },
      select: { userId: true },
    });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (photo.userId !== user.id) {
      throw new GraphQLError('You can only edit your own photos', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const { tags, takenAt, ...rest } = args.input;

    // Update tags if provided: delete existing, create new
    if (tags !== undefined) {
      await ctx.prisma.photoTag.deleteMany({ where: { photoId: args.id } });
      if (tags.length > 0) {
        await ctx.prisma.photoTag.createMany({
          data: tags.map((tag) => ({
            photoId: args.id,
            tag: tag.toLowerCase().trim(),
          })),
        });
      }
    }

    return ctx.prisma.photo.update({
      where: { id: args.id },
      data: {
        ...rest,
        ...(takenAt !== undefined && { takenAt: takenAt ? new Date(takenAt) : null }),
      },
      include: { user: true, variants: true, tags: true },
    });
  },

  deletePhoto: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const photo = await ctx.prisma.photo.findUnique({
      where: { id: args.id },
      select: { userId: true },
    });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (photo.userId !== user.id) {
      throw new GraphQLError('You can only delete your own photos', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.photo.delete({ where: { id: args.id } });
    return true;
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const photoFieldResolvers = {
  user: (parent: PhotoParent & { user?: unknown }, _args: unknown, ctx: Context) => {
    // If user was already included by Prisma, use it directly
    if (parent.user) return parent.user;
    return ctx.prisma.user.findUnique({ where: { id: parent.userId } });
  },

  variants: (parent: PhotoParent & { variants?: unknown[] }, _args: unknown, ctx: Context) => {
    if (parent.variants) return parent.variants;
    return ctx.prisma.photoVariant.findMany({ where: { photoId: parent.id } });
  },

  tags: async (parent: PhotoParent & { tags?: Array<{ tag: string }> | string[] }, _args: unknown, ctx: Context) => {
    if (parent.tags) {
      // If already resolved to string array, return directly
      if (parent.tags.length === 0) return [];
      if (typeof parent.tags[0] === 'string') return parent.tags;
      // Otherwise, it's the Prisma relation shape: { tag: string }[]
      return (parent.tags as Array<{ tag: string }>).map((t) => t.tag);
    }
    const tags = await ctx.prisma.photoTag.findMany({
      where: { photoId: parent.id },
      select: { tag: true },
    });
    return tags.map((t) => t.tag);
  },

  likeCount: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.like.count({ where: { photoId: parent.id } });
  },

  commentCount: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.comment.count({ where: { photoId: parent.id } });
  },
};
