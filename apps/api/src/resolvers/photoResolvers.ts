import { validateUpload, USER_TIER_LIMITS } from '@spotterspace/shared';
import { GraphQLError } from 'graphql';

import { requireAuth, requireRole } from '../auth/requireAuth.js';
import { getDbUser } from '../utils/resolverHelpers.js';
import type { Context } from '../context.js';
import { generateVariants, getSharp } from '../services/imageProcessing.js';
import { getObjectUrl, getPresignedUploadUrl } from '../services/s3.js';
import { decodeCursor, encodeCursor } from '../utils/resolverHelpers.js';
import { validateStringLength, validateArrayLength } from '../utils/validation.js';

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

export type PhotoSortBy =
  | 'recent'
  | 'popular_day'
  | 'popular_week'
  | 'popular_month'
  | 'popular_all';

export interface PhotosArgs {
  first?: number;
  after?: string;
  userId?: string;
  albumId?: string;
  airportCode?: string;
  tags?: string[];
  manufacturer?: string;
  family?: string;
  variant?: string;
  airline?: string;
  photographer?: string;
  sortBy?: PhotoSortBy;
}

export interface CreatePhotoInput {
  s3Key: string;
  mimeType: string;
  fileSizeBytes: number;
  caption?: string;
  airline?: string;
  airportCode?: string;
  takenAt?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  locationPrivacy?: string;
  aircraftId?: string;
  gearBody?: string;
  gearLens?: string;
  exifData?: unknown;
  photoCategoryId?: string;
  aircraftSpecificCategoryId?: string;
  operatorIcao?: string;
  operatorType?: string;
  msn?: string;
  manufacturingDate?: string;
  locationType?: string;
  airportIcao?: string;
  license?: string;
  watermarkEnabled?: boolean;
}

export interface UpdatePhotoInput {
  caption?: string;
  airline?: string;
  airportCode?: string;
  takenAt?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  locationPrivacy?: string;
  aircraftId?: string;
  gearBody?: string;
  gearLens?: string;
  exifData?: unknown;
  photoCategoryId?: string;
  aircraftSpecificCategoryId?: string;
  operatorIcao?: string;
  operatorType?: string;
  msn?: string;
  manufacturingDate?: string;
  locationType?: string;
  airportIcao?: string;
}

export interface PhotoParent {
  id: string;
  userId: string;
  aircraftId?: string | null;
  photographerId?: string | null;
  photographerName?: string | null;
  gearBody?: string | null;
  gearLens?: string | null;
  takenAt?: Date | null;
  exifData?: unknown | null;
  photoCategoryId?: string | null;
  aircraftSpecificCategoryId?: string | null;
  operatorIcao?: string | null;
  operatorType?: string | null;
  msn?: string | null;
  manufacturingDate?: string | null;
  isDeleted?: boolean;
}

// ─── Privacy Helpers ────────────────────────────────────────────────────────

/**
 * Returns a Prisma filter to exclude soft-deleted records for non-privileged users.
 * Admin, moderator, and superuser see all content.
 */
async function deletedFilter(ctx: Context): Promise<Record<string, unknown>> {
  try {
    const authUser = requireAuth(ctx);
    const dbUser = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { role: true },
    });
    if (dbUser && ['admin', 'moderator', 'superuser'].includes(dbUser.role)) {
      return {};
    }
  } catch {
    // Not authenticated
  }
  return { isDeleted: false };
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const photoQueryResolvers = {
  photo: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    const filter = await deletedFilter(ctx);
    return ctx.prisma.photo.findFirst({
      where: { id: args.id, ...filter },
      include: {
        user: true,
        variants: true,
        tags: true,
        aircraft: {
          include: { manufacturer: true, family: true, variant: true, airlineRef: true },
        },
        location: { include: { airport: true, spottingLocation: true } },
        photoCategory: true,
        aircraftSpecificCategory: true,
      },
    });
  },

  photos: async (_parent: unknown, args: PhotosArgs, ctx: Context) => {
    const take = Math.min(args.first ?? 20, 50);
    const deletedFilter_ = await deletedFilter(ctx);

    // Build filter conditions
    const where: Record<string, unknown> = {
      moderationStatus: 'approved',
      ...deletedFilter_,
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
    if (args.airportCode) {
      where.airportCode = { equals: args.airportCode, mode: 'insensitive' };
    }
    if (args.tags && args.tags.length > 0) {
      where.tags = {
        some: { tag: { in: args.tags } },
      };
    }
    if (args.airline) {
      where.airline = { contains: args.airline, mode: 'insensitive' };
    }
    if (args.photographer) {
      where.photographerName = { contains: args.photographer, mode: 'insensitive' };
    }

    // Aircraft hierarchy filters — all three can be applied simultaneously
    const aircraftFilter: Record<string, unknown> = {};
    if (args.manufacturer) {
      aircraftFilter.manufacturer = { name: { contains: args.manufacturer, mode: 'insensitive' } };
    }
    if (args.family) {
      aircraftFilter.family = { name: { contains: args.family, mode: 'insensitive' } };
    }
    if (args.variant) {
      aircraftFilter.variant = { name: { contains: args.variant, mode: 'insensitive' } };
    }
    if (Object.keys(aircraftFilter).length > 0) {
      where.aircraft = aircraftFilter;
    }

    // Determine sort order
    let orderBy: Record<string, unknown> = { createdAt: 'desc' };
    if (args.sortBy === 'popular_all') {
      orderBy = { likeCount: 'desc' };
    } else if (args.sortBy === 'popular_day') {
      const cutoff = new Date(Date.now() - 86_400_000);
      where.createdAt = { ...((where.createdAt as object) || {}), gte: cutoff };
      orderBy = { likeCount: 'desc' };
    } else if (args.sortBy === 'popular_week') {
      const cutoff = new Date(Date.now() - 7 * 86_400_000);
      where.createdAt = { ...((where.createdAt as object) || {}), gte: cutoff };
      orderBy = { likeCount: 'desc' };
    } else if (args.sortBy === 'popular_month') {
      const cutoff = new Date(Date.now() - 30 * 86_400_000);
      where.createdAt = { ...((where.createdAt as object) || {}), gte: cutoff };
      orderBy = { likeCount: 'desc' };
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.photo.findMany({
        where,
        orderBy,
        take: take + 1,
        include: {
          user: true,
          variants: true,
          tags: true,
          aircraft: {
            include: { manufacturer: true, family: true, variant: true, airlineRef: true },
          },
          location: { include: { airport: true, spottingLocation: true } },
          photoCategory: true,
          aircraftSpecificCategory: true,
        },
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

    // Enforce monthly upload quota
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const uploadsThisMonth = await ctx.prisma.photo.count({
      where: { userId: user.id, createdAt: { gte: monthStart } },
    });
    const limit = USER_TIER_LIMITS.free.uploadsPerMonth;
    if (uploadsThisMonth >= limit) {
      throw new GraphQLError(
        `Monthly upload limit reached (${limit} photos/month). Upgrade for higher limits.`,
        { extensions: { code: 'FORBIDDEN' } },
      );
    }

    return getPresignedUploadUrl(user.id, args.input.mimeType);
  },

  createPhoto: async (_parent: unknown, args: { input: CreatePhotoInput }, ctx: Context) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      include: { profile: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const { input } = args;
    validateStringLength(input.caption, 'Caption', 0, 2000);
    validateArrayLength(input.tags, 'Tags', 30);

    // Validate image dimensions using admin-configured limits from SiteSettings
    const { getObject } = await import('../services/s3.js');
    const originalBuffer = await getObject(input.s3Key);
    const sharp = await getSharp();
    const metadata = await sharp(originalBuffer).metadata();
    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;
    const longEdge = Math.max(originalWidth, originalHeight);

    const siteSettings = await ctx.prisma.siteSettings.findUnique({
      where: { id: 'site_settings' },
    });
    const minLongEdge = siteSettings?.minPhotoLongEdge ?? USER_TIER_LIMITS.free.minLongEdge;
    const maxLongEdge = siteSettings?.maxPhotoLongEdge ?? USER_TIER_LIMITS.free.maxResolution;

    if (longEdge < minLongEdge) {
      throw new GraphQLError(
        `Image is too small. Minimum ${minLongEdge}px on the long edge required (yours is ${longEdge}px).`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }
    if (longEdge > maxLongEdge) {
      throw new GraphQLError(
        `Image resolution too high. Maximum ${maxLongEdge}px on the long edge (yours is ${longEdge}px).`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    const originalUrl = getObjectUrl(input.s3Key);

    // Auto-credit photographer to uploader, photographerName from profile displayName
    const photographerId = user.id;
    const photographerName = user.profile?.displayName ?? user.username;

    // Create the photo record
    const photo = await ctx.prisma.photo.create({
      data: {
        userId: user.id,
        caption: input.caption,
        airline: input.airline,
        airportCode: input.airportCode,
        takenAt: input.takenAt ? new Date(input.takenAt) : null,
        originalUrl,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        originalWidth,
        originalHeight,
        photographerId,
        photographerName,
        aircraftId: input.aircraftId ?? null,
        gearBody: input.gearBody ?? null,
        gearLens: input.gearLens ?? null,
        exifData: input.exifData ?? undefined,
        photoCategoryId: input.photoCategoryId ?? null,
        aircraftSpecificCategoryId: input.aircraftSpecificCategoryId ?? null,
        operatorIcao: input.operatorIcao ?? null,
        operatorType: input.operatorType
          ? (input.operatorType.toLowerCase() as
              | 'airline'
              | 'general_aviation'
              | 'military'
              | 'government'
              | 'cargo'
              | 'charter'
              | 'private')
          : null,
        msn: input.msn ?? null,
        manufacturingDate: input.manufacturingDate ?? null,
        // In dev, auto-approve; in production, start as pending
        moderationStatus: process.env.NODE_ENV === 'production' ? 'pending' : 'approved',
        license: (input.license ?? 'ALL_RIGHTS_RESERVED') as
          | 'ALL_RIGHTS_RESERVED'
          | 'CC_BY_NC_ND'
          | 'CC_BY_NC'
          | 'CC_BY_NC_SA'
          | 'CC_BY'
          | 'CC_BY_SA',
        watermarkEnabled: input.watermarkEnabled ?? false,
        tags: input.tags
          ? { create: input.tags.map((tag) => ({ tag: tag.toLowerCase().trim() })) }
          : undefined,
      },
      include: { user: true, variants: true, tags: true },
    });

    // Generate image variants asynchronously (in dev, synchronous for simplicity)
    try {
      const variants = await generateVariants(input.s3Key, {
        watermarkEnabled: input.watermarkEnabled ?? false,
      });
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

    // Validate latitude/longitude ranges before storing
    if (input.latitude != null && (input.latitude < -90 || input.latitude > 90)) {
      throw new GraphQLError('Latitude must be between -90 and 90', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (input.longitude != null && (input.longitude < -180 || input.longitude > 180)) {
      throw new GraphQLError('Longitude must be between -180 and 180', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Create location if coordinates provided
    if (input.latitude != null && input.longitude != null) {
      const privacyMode = input.locationPrivacy ?? 'exact';
      const { displayLat, displayLng } = applyPrivacy(input.latitude, input.longitude, privacyMode);

      // Find associated airport by airportIcao or airportCode
      let airportId: string | null = null;
      let country: string | null = null;
      const lookupCode = (input.airportIcao ?? input.airportCode ?? '').trim().toUpperCase();
      if (lookupCode) {
        const airport = await ctx.prisma.airport.findFirst({
          where: { OR: [{ icaoCode: lookupCode }, { iataCode: lookupCode }] },
        });
        if (airport) {
          airportId = airport.id;
          country = airport.country;
        }
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
          locationType: input.locationType ?? (airportId ? 'airport' : null),
          country,
        },
      });
    }

    // Re-fetch to include location data
    return (
      ctx.prisma.photo.findUnique({
        where: { id: photo.id },
        include: { user: true, variants: true, tags: true },
      }) ?? photo
    );
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

    // Validate latitude/longitude ranges if provided
    if (args.input.latitude !== undefined && args.input.latitude !== null && (args.input.latitude < -90 || args.input.latitude > 90)) {
      throw new GraphQLError('Latitude must be between -90 and 90', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (args.input.longitude !== undefined && args.input.longitude !== null && (args.input.longitude < -180 || args.input.longitude > 180)) {
      throw new GraphQLError('Longitude must be between -180 and 180', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    validateStringLength(args.input.caption, 'Caption', 0, 2000);
    validateArrayLength(args.input.tags, 'Tags', 30);

    const {
      tags,
      takenAt,
      latitude,
      longitude,
      locationPrivacy,
      aircraftId,
      gearBody,
      gearLens,
      exifData,
      photoCategoryId,
      aircraftSpecificCategoryId,
      operatorIcao,
      operatorType,
      msn,
      manufacturingDate,
      locationType,
      airportIcao,
      ...rest
    } = args.input;

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

        // Find associated airport by airportIcao or airportCode
        let airportId: string | null = null;
        let country: string | null = null;
        const lookupCode = (airportIcao ?? '').trim().toUpperCase();
        if (lookupCode) {
          const airport = await ctx.prisma.airport.findFirst({
            where: { OR: [{ icaoCode: lookupCode }, { iataCode: lookupCode }] },
          });
          if (airport) {
            airportId = airport.id;
            country = airport.country;
          }
        }

        await ctx.prisma.photoLocation.upsert({
          where: { photoId: args.id },
          update: {
            rawLatitude: latitude,
            rawLongitude: longitude,
            displayLatitude: displayLat,
            displayLongitude: displayLng,
            privacyMode: privacyMode as 'exact' | 'approximate' | 'hidden',
            ...(airportId !== undefined && { airportId }),
            ...(locationType !== undefined && { locationType: locationType ?? null }),
            ...(country !== undefined && { country }),
          },
          create: {
            photoId: args.id,
            rawLatitude: latitude,
            rawLongitude: longitude,
            displayLatitude: displayLat,
            displayLongitude: displayLng,
            privacyMode: privacyMode as 'exact' | 'approximate' | 'hidden',
            airportId,
            locationType: locationType ?? (airportId ? 'airport' : null),
            country,
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
        ...(gearBody !== undefined && { gearBody: gearBody ?? null }),
        ...(gearLens !== undefined && { gearLens: gearLens ?? null }),
        ...(exifData !== undefined && { exifData: exifData ?? undefined }),
        ...(photoCategoryId !== undefined && { photoCategoryId: photoCategoryId ?? null }),
        ...(aircraftSpecificCategoryId !== undefined && {
          aircraftSpecificCategoryId: aircraftSpecificCategoryId ?? null,
        }),
        ...(operatorIcao !== undefined && { operatorIcao: operatorIcao ?? null }),
        ...(operatorType !== undefined && {
          operatorType: operatorType
            ? (operatorType.toLowerCase() as
                | 'airline'
                | 'general_aviation'
                | 'military'
                | 'government'
                | 'cargo'
                | 'charter'
                | 'private')
            : null,
        }),
        ...(msn !== undefined && { msn: msn ?? null }),
        ...(manufacturingDate !== undefined && { manufacturingDate: manufacturingDate ?? null }),
      },
      include: { user: true, variants: true, tags: true },
    });
  },

  approvePhoto: async (_parent: unknown, args: { photoId: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'moderator', 'superuser']);

    const photo = await ctx.prisma.photo.findUnique({ where: { id: args.photoId } });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return ctx.prisma.photo.update({
      where: { id: args.photoId },
      data: { moderationStatus: 'approved' },
      include: { user: true, variants: true, tags: true },
    });
  },

  rejectPhoto: async (
    _parent: unknown,
    args: { photoId: string; reason?: string },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'moderator', 'superuser']);

    const photo = await ctx.prisma.photo.findUnique({ where: { id: args.photoId } });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return ctx.prisma.photo.update({
      where: { id: args.photoId },
      data: {
        moderationStatus: 'rejected',
        ...(args.reason && { moderationLabels: { reason: args.reason } }),
      },
      include: { user: true, variants: true, tags: true },
    });
  },

  deletePhoto: async (_parent: unknown, args: { id: string }, ctx: Context) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true, role: true },
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

    // Admin/moderator/superuser can delete any photo
    const isPrivileged =
      user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser';

    if (!isPrivileged && photo.userId !== user.id) {
      throw new GraphQLError('You do not have permission to delete this photo', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.photo.delete({ where: { id: args.id } });
    return true;
  },

  softDeletePhoto: async (
    _parent: unknown,
    args: { id: string; reason?: string },
    ctx: Context,
  ) => {
    await requireRole(ctx, ['admin', 'moderator', 'superuser']);
    const dbUser = await getDbUser(ctx);

    const photo = await ctx.prisma.photo.findUnique({ where: { id: args.id } });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }

    await ctx.prisma.communityModerationLog.create({
      data: {
        communityId: 'global',
        moderatorId: dbUser.id,
        targetUserId: photo.userId,
        action: 'delete_photo',
        reason: args.reason ?? 'Soft delete requested',
        metadata: { photoId: photo.id, mode: 'SOFT' },
      },
    });

    await ctx.prisma.photo.update({
      where: { id: args.id },
      data: { isDeleted: true },
    });
    return true;
  },

  hardDeletePhoto: async (_parent: unknown, args: { id: string; reason: string }, ctx: Context) => {
    await requireRole(ctx, ['admin', 'moderator', 'superuser']);
    const dbUser = await getDbUser(ctx);

    if (!args.reason) {
      throw new GraphQLError('A reason is required for hard deletion', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const photo = await ctx.prisma.photo.findUnique({ where: { id: args.id } });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }

    await ctx.prisma.communityModerationLog.create({
      data: {
        communityId: 'global',
        moderatorId: dbUser.id,
        targetUserId: photo.userId,
        action: 'delete_photo',
        reason: args.reason,
        metadata: { photoId: photo.id, mode: 'HARD' },
      },
    });

    await ctx.prisma.photo.delete({ where: { id: args.id } });
    return true;
  },

  regeneratePhotoVariants: async (_parent: unknown, args: { photoId: string }, ctx: Context) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const photo = await ctx.prisma.photo.findUnique({
      where: { id: args.photoId },
      include: { user: true, variants: true, tags: true },
    });
    if (!photo) {
      throw new GraphQLError('Photo not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Only owner or privileged users can regenerate
    const isPrivileged = ['admin', 'moderator', 'superuser'].includes(user.role);
    if (photo.userId !== user.id && !isPrivileged) {
      throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
    }

    // Derive S3 key from originalUrl by stripping the host prefix
    const url = new URL(photo.originalUrl);
    const s3Key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

    // Delete existing variants
    await ctx.prisma.photoVariant.deleteMany({ where: { photoId: photo.id } });

    // Regenerate variants
    const variants = await generateVariants(s3Key, {
      watermarkEnabled: photo.watermarkEnabled,
    });

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

    return ctx.prisma.photo.findUnique({
      where: { id: photo.id },
      include: { user: true, variants: true, tags: true },
    });
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

  tags: async (
    parent: PhotoParent & { tags?: Array<{ tag: string }> | string[] },
    _args: unknown,
    ctx: Context,
  ) => {
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
    return ctx.loaders.photoLikeCount.load(parent.id);
  },

  commentCount: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    return ctx.loaders.photoCommentCount.load(parent.id);
  },

  location: async (parent: PhotoParent, _args: unknown, ctx: Context) => {
    const loc = await ctx.loaders.photoLocation.load(parent.id);
    if (!loc || loc.privacyMode === 'hidden') return null;
    return {
      id: loc.id,
      latitude: loc.displayLatitude,
      longitude: loc.displayLongitude,
      privacyMode: loc.privacyMode,
      locationType: loc.locationType,
      country: loc.country,
      airport: loc.airport,
      spottingLocation: loc.spottingLocation,
    };
  },

  aircraft: (
    parent: PhotoParent & { aircraftId?: string | null },
    _args: unknown,
    ctx: Context,
  ) => {
    if (!parent.aircraftId) return null;
    return ctx.loaders.aircraftById.load(parent.aircraftId);
  },

  photographer: (
    parent: PhotoParent & { photographerId?: string | null },
    _args: unknown,
    ctx: Context,
  ) => {
    if (!parent.photographerId) return null;
    return ctx.loaders.userById.load(parent.photographerId);
  },

  takenAt: (parent: { takenAt: Date | null }) => parent.takenAt?.toISOString() ?? null,

  createdAt: (parent: { createdAt: Date | null }) => parent.createdAt?.toISOString() ?? null,

  operatorType: (parent: { operatorType: string | null }) =>
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

  exifData: (parent: PhotoParent) => parent.exifData ?? null,

  photoCategory: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    if (!parent.photoCategoryId) return null;
    return ctx.prisma.photoCategory.findUnique({ where: { id: parent.photoCategoryId } });
  },

  aircraftSpecificCategory: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    if (!parent.aircraftSpecificCategoryId) return null;
    return ctx.prisma.aircraftSpecificCategory.findUnique({
      where: { id: parent.aircraftSpecificCategoryId },
    });
  },

  listing: (parent: PhotoParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.photoListing.findUnique({
      where: { photoId: parent.id },
    });
  },

  hasActiveListing: (parent: PhotoParent & { hasActiveListing?: boolean }) => {
    return parent.hasActiveListing ?? false;
  },

  operatorIcao: (parent: PhotoParent) => parent.operatorIcao ?? null,

  similarAircraftPhotos: async (
    parent: PhotoParent,
    args: { first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 12, 30);

    // Match by aircraftId if linked, otherwise by msn + manufacturerId
    const where: Record<string, unknown> = {
      id: { not: parent.id },
      moderationStatus: 'approved',
    };

    if (parent.aircraftId) {
      where.aircraftId = parent.aircraftId;
    } else if (parent.msn) {
      where.msn = parent.msn;
    } else {
      // No aircraft linked and no msn — return empty
      return {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: 0,
      };
    }

    if (args.after) {
      const cursorPhoto = await ctx.prisma.photo.findUnique({ where: { id: args.after } });
      if (cursorPhoto) {
        where.createdAt = { lt: cursorPhoto.createdAt };
      }
    }

    const [items, totalCount] = await Promise.all([
      ctx.prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        include: {
          user: { include: { profile: true } },
          variants: true,
          aircraft: { include: { manufacturer: true, family: true, variant: true } },
        },
      }),
      ctx.prisma.photo.count({ where }),
    ]);

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((p) => ({
      cursor: p.id,
      node: p,
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
