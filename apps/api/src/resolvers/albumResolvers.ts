import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AlbumParent {
  id: string;
  userId: string;
  coverPhotoId?: string | null;
}

export interface CreateAlbumInput {
  title: string;
  description?: string | null;
  isPublic?: boolean | null;
}

export interface UpdateAlbumInput {
  title?: string | null;
  description?: string | null;
  isPublic?: boolean | null;
  coverPhotoId?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

async function getDbUser(ctx: Context) {
  const authUser = requireAuth(ctx);
  const dbUser = await ctx.prisma.user.findUnique({
    where: { cognitoSub: authUser.sub },
  });
  if (!dbUser) {
    throw new GraphQLError('User not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  return dbUser;
}

async function requireAlbumOwner(ctx: Context, albumId: string) {
  const dbUser = await getDbUser(ctx);
  const album = await ctx.prisma.album.findUnique({
    where: { id: albumId },
  });
  if (!album) {
    throw new GraphQLError('Album not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  if (album.userId !== dbUser.id) {
    throw new GraphQLError('You can only modify your own albums', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return { dbUser, album };
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const albumQueryResolvers = {
  album: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    return ctx.prisma.album.findUnique({
      where: { id: args.id },
      include: {
        user: { include: { profile: true } },
        coverPhoto: { include: { variants: true } },
      },
    });
  },

  albums: async (
    _parent: unknown,
    args: { userId?: string; first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);

    // Determine whose albums to fetch
    let targetUserId = args.userId;
    if (!targetUserId) {
      const dbUser = await getDbUser(ctx);
      targetUserId = dbUser.id;
    }

    const where: Record<string, unknown> = { userId: targetUserId };

    // Unless it's the owner, only show public albums
    let isOwner = false;
    if (ctx.user) {
      const viewer = await ctx.prisma.user.findUnique({
        where: { cognitoSub: ctx.user.sub },
        select: { id: true },
      });
      isOwner = viewer?.id === targetUserId;
    }
    if (!isOwner) {
      where.isPublic = true;
    }

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
    }

    const [albums, totalCount] = await Promise.all([
      ctx.prisma.album.findMany({
        where,
        take: take + 1,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
          coverPhoto: { include: { variants: true } },
        },
      }),
      ctx.prisma.album.count({ where: { ...where, createdAt: undefined } }),
    ]);

    const hasNextPage = albums.length > take;
    const edges = albums.slice(0, take).map((album) => ({
      cursor: encodeCursor(album.createdAt),
      node: album,
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

export const albumMutationResolvers = {
  createAlbum: async (
    _parent: unknown,
    args: { input: CreateAlbumInput },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);
    const { title, description, isPublic } = args.input;

    if (!title.trim()) {
      throw new GraphQLError('Album title cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (title.length > 100) {
      throw new GraphQLError('Album title must be 100 characters or fewer', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.album.create({
      data: {
        userId: dbUser.id,
        title: title.trim(),
        description: description?.trim() || null,
        isPublic: isPublic ?? true,
      },
      include: {
        user: { include: { profile: true } },
        coverPhoto: true,
      },
    });
  },

  updateAlbum: async (
    _parent: unknown,
    args: { id: string; input: UpdateAlbumInput },
    ctx: Context,
  ) => {
    const { album } = await requireAlbumOwner(ctx, args.id);
    const { title, description, isPublic, coverPhotoId } = args.input;

    const data: Record<string, unknown> = {};

    if (title !== undefined && title !== null) {
      const trimmed = title.trim();
      if (!trimmed) {
        throw new GraphQLError('Album title cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      if (trimmed.length > 100) {
        throw new GraphQLError('Album title must be 100 characters or fewer', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      data.title = trimmed;
    }

    if (description !== undefined) {
      data.description = description?.trim() || null;
    }

    if (isPublic !== undefined && isPublic !== null) {
      data.isPublic = isPublic;
    }

    if (coverPhotoId !== undefined) {
      if (coverPhotoId === null) {
        data.coverPhotoId = null;
      } else {
        // Verify the photo belongs to this album
        const photo = await ctx.prisma.photo.findFirst({
          where: { id: coverPhotoId, albumId: album.id },
        });
        if (!photo) {
          throw new GraphQLError('Cover photo must be a photo in this album', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        data.coverPhotoId = coverPhotoId;
      }
    }

    return ctx.prisma.album.update({
      where: { id: args.id },
      data,
      include: {
        user: { include: { profile: true } },
        coverPhoto: { include: { variants: true } },
      },
    });
  },

  deleteAlbum: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    await requireAlbumOwner(ctx, args.id);

    // Unlink photos from the album first
    await ctx.prisma.photo.updateMany({
      where: { albumId: args.id },
      data: { albumId: null },
    });

    await ctx.prisma.album.delete({ where: { id: args.id } });
    return true;
  },

  addPhotosToAlbum: async (
    _parent: unknown,
    args: { albumId: string; photoIds: string[] },
    ctx: Context,
  ) => {
    const { dbUser } = await requireAlbumOwner(ctx, args.albumId);

    // Verify all photos belong to the user
    const photos = await ctx.prisma.photo.findMany({
      where: { id: { in: args.photoIds }, userId: dbUser.id },
      select: { id: true },
    });

    if (photos.length !== args.photoIds.length) {
      throw new GraphQLError('You can only add your own photos to an album', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.photo.updateMany({
      where: { id: { in: args.photoIds } },
      data: { albumId: args.albumId },
    });

    return ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      include: {
        user: { include: { profile: true } },
        coverPhoto: { include: { variants: true } },
      },
    });
  },

  removePhotosFromAlbum: async (
    _parent: unknown,
    args: { albumId: string; photoIds: string[] },
    ctx: Context,
  ) => {
    await requireAlbumOwner(ctx, args.albumId);

    await ctx.prisma.photo.updateMany({
      where: { id: { in: args.photoIds }, albumId: args.albumId },
      data: { albumId: null },
    });

    return ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      include: {
        user: { include: { profile: true } },
        coverPhoto: { include: { variants: true } },
      },
    });
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const albumFieldResolvers = {
  user: (parent: AlbumParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.user.findUnique({
      where: { id: parent.userId },
      include: { profile: true },
    });
  },

  coverPhoto: (parent: AlbumParent, _args: unknown, ctx: Context) => {
    if (!parent.coverPhotoId) return null;
    return ctx.prisma.photo.findUnique({
      where: { id: parent.coverPhotoId },
      include: { variants: true },
    });
  },

  photoCount: (parent: AlbumParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.photo.count({ where: { albumId: parent.id } });
  },
};
