import { validateUpload } from '@spotterhub/shared';
import { GraphQLError } from 'graphql';


import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';
import { generateVariants } from '../services/imageProcessing.js';
import { getObjectUrl, getPresignedUploadUrl } from '../services/s3.js';
import { decodeCursor, encodeCursor } from '../utils/resolverHelpers.js';

// ─── Privacy Helpers ────────────────────────────────────────────────────────

/**
 * Apply privacy mode to coordinates.
 * - exact: use raw coordinates as-is
 * - approximate: jitter by ~500m random offset
 * - hidden: set display coords to 0 (won't be returned by field resolver)
 */
function applyPrivacy(lat: number, lng: number, mode: string) {
  switch (mode) {
    case 'approximate': {
      const jitterLat = (Math.random() - 0.5) * 0.01;
      const jitterLng = (Math.random() - 0.5) * 0.01;
      return { displayLat: lat + jitterLat, displayLng: lng + jitterLng };
    }
    case 'hidden':
      return { displayLat: 0, displayLng: 0 };
    case 'exact':
    default:
      return { displayLat: lat, displayLng: lng };
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type PhotoSortBy = 'recent' | 'popular_day' | 'popular_week' | 'popular_month' | 'popular_all';

export interface PhotosArgs {
  first?: number;
  after?: string;
  userId?: string;
  albumId?: string;
  aircraftType?: string;
  airportCode?: string;
  tags?: string[];
  manufacturer?: string;
  airline?: string;
  photographer?: string;
  sortBy?: PhotoSortBy;
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
  latitude?: number;
  longitude?: number;
  locationPrivacy?: string;
  aircraftId?: string;
  aircraftTypeId?: string;
  gearBody?: string;
  gearLens?: string;
}

export interface UpdatePhotoInput {
  caption?: string;
  aircraftType?: string;
  airline?: string;
  airportCode?: string;
  takenAt?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  locationPrivacy?: string;
  aircraftId?: string;
  aircraftTypeId?: string;
  gearBody?: string;
  gearLens?: string;
}

export interface PhotoParent {
  id: string;
  userId: string;
  aircraftTypeName?: string | null;
  aircraftId?: string | null;
  aircraftTypeId?: string | null;
  photographerId?: string | null;
  photographerName?: string | null;
  gearBody?: string | null;
  gearLens?: string | null;
  takenAt?: Date | null;
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
      where.aircraftTypeName = { contains: args.aircraftType, mode: 'insensitive' };
    }
    if (args.airportCode) {
      where.airportCode = { equals: args.airportCode, mode: 'insensitive' };
    }
    if (args.tags && args.tags.length > 0) {
      where.tags = {
        some: { tag: { in: args.tags } },
      };
    }
    if (args.manufacturer) {
      // Manufacturer is derived: aircraftTypeName starts with manufacturer name
      // e.g. "Boeing 747" -> manufacturer "Boeing"
      where.aircraftTypeName = {
        ...(where.aircraftTypeName as object || {}),
        startsWith: args.manufacturer,
        mode: 'insensitive',
      };
    }
    if (args.airline) {
      where.airline = { contains: args.airline, mode: 'insensitive' };
    }
    if (args.photographer) {
      where.photographerName = { contains: args.photographer, mode: 'insensitive' };
    }

    // Determine sort order
    let orderBy: Record<string, unknown> = { createdAt: 'desc' };
    if (args.sortBy === 'popular_all') {
      orderBy = { likeCount: 'desc' };
    } else if (args.sortBy === 'popular_day') {
      const cutoff = new Date(Date.now() - 86_400_000);
      where.createdAt = { ...(where.createdAt as object || {}), gte: cutoff };
      orderBy = { likeCount: 'desc' };
    } else if (args.sortBy === 'popular_week') {
      const cutoff = new Date(Date.now() - 7 * 86_400_000);
      where.createdAt = { ...(where.createdAt as object || {}), gte: cutoff };
      orderBy = { likeCount: 'desc' };
    } else if (args.sortBy === 'popular_month') {
      const cutoff = new Date(Date.now() - 30 * 86_400_000);
      where.createdAt = { ...(where.createdAt as object || {}), gte: cutoff };
      orderBy = { likeCount: 'desc' };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.photo.findMany({
        where,
        orderBy,
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
      include: { profile: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const { input } = args;
    const originalUrl = getObjectUrl(input.s3Key);

    // Auto-credit photographer to uploader, photographerName from profile displayName
    const photographerId = user.id;
    const photographerName = user.profile?.displayName ?? user.username;

    // Create the photo record
    const photo = await ctx.prisma.photo.create({
      data: {
        userId: user.id,
        caption: input.caption,
        aircraftTypeName: input.aircraftType,
        airline: input.airline,
        airportCode: input.airportCode,
        takenAt: input.takenAt ? new Date(input.takenAt) : null,
        originalUrl,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        photographerId,
        photographerName,
        aircraftId: input.aircraftId ?? null,
        aircraftTypeId: input.aircraftTypeId ?? null,
        gearBody: input.gearBody ?? null,
        gearLens: input.gearLens ?? null,
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

    // Create location if coordinates provided
    if (input.latitude != null && input.longitude != null) {
      const privacyMode = input.locationPrivacy ?? 'exact';
      const { displayLat, displayLng } = applyPrivacy(
        input.latitude,
        input.longitude,
        privacyMode,
      );

      // Find associated airport by code if provided
      let airportId: string | null = null;
      if (input.airportCode) {
        const code = input.airportCode.trim().toUpperCase();
        const airport = await ctx.prisma.airport.findFirst({
          where: { OR: [{ icaoCode: code }, { iataCode: code }] },
          select: { id: true },
        });
        if (airport) airportId = airport.id;
      }

      await ctx.prisma.photoLocation.create({
        data: {
          photoId: photo.id,
          rawLatitude: input.latitude,
          rawLongitude: input.longitude,
          displayLatitude: displayLat,
          displayLongitude: displayLng,
          privacyMode: privacyMode as 'exact' | 'approximate' | 'hidden',
          airportId,
        },
      });
    }

    // Re-fetch to include location data
    return ctx.prisma.photo.findUnique({
      where: { id: photo.id },
      include: { user: true, variants: true, tags: true },
    }) ?? photo;
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

    const { tags, takenAt, latitude, longitude, locationPrivacy, aircraftId, aircraftTypeId, aircraftType, gearBody, gearLens, ...rest } = args.input;

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

    // Update location if coordinates provided
    if (latitude !== undefined) {
      if (latitude != null && longitude != null) {
        const privacyMode = locationPrivacy ?? 'exact';
        const { displayLat, displayLng } = applyPrivacy(latitude, longitude, privacyMode);

        await ctx.prisma.photoLocation.upsert({
          where: { photoId: args.id },
          update: {
            rawLatitude: latitude,
            rawLongitude: longitude,
            displayLatitude: displayLat,
            displayLongitude: displayLng,
            privacyMode: privacyMode as 'exact' | 'approximate' | 'hidden',
          },
          create: {
            photoId: args.id,
            rawLatitude: latitude,
            rawLongitude: longitude,
            displayLatitude: displayLat,
            displayLongitude: displayLng,
            privacyMode: privacyMode as 'exact' | 'approximate' | 'hidden',
          },
        });
      } else {
        // Remove location if latitude explicitly set to null
        await ctx.prisma.photoLocation.deleteMany({ where: { photoId: args.id } });
      }
    }

    return ctx.prisma.photo.update({
      where: { id: args.id },
      data: {
        ...rest,
        ...(takenAt !== undefined && { takenAt: takenAt ? new Date(takenAt) : null }),
        ...(aircraftId !== undefined && { aircraftId: aircraftId ?? null }),
        ...(aircraftTypeId !== undefined && { aircraftTypeId: aircraftTypeId ?? null }),
        ...(aircraftType !== undefined && { aircraftTypeName: aircraftType }),
        ...(gearBody !== undefined && { gearBody: gearBody ?? null }),
        ...(gearLens !== undefined && { gearLens: gearLens ?? null }),
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

  location: async (parent: PhotoParent, _args: unknown, ctx: Context) => {
    const loc = await ctx.prisma.photoLocation.findUnique({
      where: { photoId: parent.id },
      include: {
        airport: true,
        spottingLocation: { include: { createdBy: { include: { profile: true } } } },
      },
    });
    if (!loc || loc.privacyMode === 'hidden') return null;
    return {
      id: loc.id,
      latitude: loc.displayLatitude,
      longitude: loc.displayLongitude,
      privacyMode: loc.privacyMode,
      airport: loc.airport,
      spottingLocation: loc.spottingLocation,
    };
  },

  aircraft: (parent: PhotoParent & { aircraftId?: string | null }, _args: unknown, ctx: Context) => {
    if (!parent.aircraftId) return null;
    return ctx.prisma.aircraft.findUnique({ where: { id: parent.aircraftId } });
  },

  aircraftType: (parent: PhotoParent) => parent.aircraftTypeName ?? null,

  aircraftTypeRef: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    if (!parent.aircraftTypeId) return null;
    return ctx.prisma.aircraftType.findUnique({ where: { id: parent.aircraftTypeId } });
  },

  photographer: (parent: PhotoParent & { photographerId?: string | null }, _args: unknown, ctx: Context) => {
    if (!parent.photographerId) return null;
    return ctx.prisma.user.findUnique({ where: { id: parent.photographerId } });
  },

  takenAt: (parent: { takenAt: Date | null }) =>
    parent.takenAt?.toISOString() ?? null,
};
