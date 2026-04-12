import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, getDbUser } from '../utils/resolverHelpers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AlbumParent {
  id: string;
  userId: string;
  coverPhotoId?: string | null;
  communityId?: string | null;
}

export interface CreateAlbumInput {
  title: string;
  description?: string | null;
  isPublic?: boolean | null;
  communityId?: string;
}

export interface UpdateAlbumInput {
  title?: string | null;
  description?: string | null;
  isPublic?: boolean | null;
  coverPhotoId?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    const album = await ctx.prisma.album.findUnique({
      where: { id: args.id },
      include: {
        user: { include: { profile: true } },
        coverPhoto: { include: { variants: true } },
        community: true,
      },
    });

    if (!album) return null;

    // Attach myMembership if user is authenticated
    if (ctx.user) {
      const dbUser = await ctx.prisma.user.findUnique({
        where: { cognitoSub: ctx.user.sub },
        select: { id: true },
      });
      if (dbUser && album.communityId) {
        const membership = await ctx.prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: album.communityId, userId: dbUser.id } },
        });
        // @ts-expect-error - attaching computed field not in schema
        album.myMembership = membership ?? null;
      }
    }

    return album;
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

    const where: Record<string, unknown> = { userId: targetUserId, communityId: null };

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
    const dbUser = await getDbUser(ctx);
    const album = await ctx.prisma.album.findUnique({
      where: { id: args.id },
      select: { userId: true, communityId: true },
    });
    if (!album) {
      throw new GraphQLError('Album not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Community albums — only owner/admin can edit
    if (album.communityId) {
      const isSuperuser = dbUser.role === 'superuser';
      const membership = await ctx.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: album.communityId, userId: dbUser.id } },
      });
      if (!isSuperuser && (!membership || !['owner', 'admin'].includes(membership.role))) {
        throw new GraphQLError('Only community owners and admins can edit this album', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    } else {
      // Personal albums — only the owner can edit
      if (album.userId !== dbUser.id) {
        throw new GraphQLError('You can only edit your own albums', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

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
        // Verify the photo is in this album
        let photoExists = false;
        if (album.communityId) {
          const entry = await ctx.prisma.albumPhoto.findUnique({
            where: { albumId_photoId: { albumId: args.id, photoId: coverPhotoId } },
          });
          photoExists = !!entry;
        } else {
          const photo = await ctx.prisma.photo.findFirst({
            where: { id: coverPhotoId, albumId: args.id },
          });
          photoExists = !!photo;
        }
        if (!photoExists) {
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
        community: true,
        coverPhoto: { include: { variants: true } },
      },
    });
  },

  deleteAlbum: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const album = await ctx.prisma.album.findUnique({
      where: { id: args.id },
      select: { userId: true, communityId: true },
    });
    if (!album) {
      throw new GraphQLError('Album not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Community albums — only owner/admin can delete
    if (album.communityId) {
      const dbUser = await getDbUser(ctx);
      const isSuperuser = dbUser.role === 'superuser';
      const membership = await ctx.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: album.communityId, userId: dbUser.id } },
      });
      if (!isSuperuser && (!membership || !['owner', 'admin'].includes(membership.role))) {
        throw new GraphQLError('Only community owners and admins can delete this album', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    } else {
      // Personal albums — only the owner can delete
      const dbUser = await getDbUser(ctx);
      if (album.userId !== dbUser.id) {
        throw new GraphQLError('You can only delete your own albums', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    // Unlink personal album photos
    await ctx.prisma.photo.updateMany({
      where: { albumId: args.id },
      data: { albumId: null },
    });

    // Delete junction table entries for community albums
    await ctx.prisma.albumPhoto.deleteMany({
      where: { albumId: args.id },
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
    const dbUser = await getDbUser(ctx);
    const album = await ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      select: { userId: true, communityId: true },
    });
    if (!album) {
      throw new GraphQLError('Album not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (album.communityId) {
      throw new GraphQLError('Use removePhotosFromCommunityAlbum for community albums', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (album.userId !== dbUser.id) {
      throw new GraphQLError('You can only remove photos from your own albums', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

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

  createCommunityAlbum: async (
    _parent: unknown,
    args: { communityId: string; input: CreateAlbumInput },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const community = await ctx.prisma.community.findUnique({
      where: { id: args.communityId },
    });
    if (!community) {
      throw new GraphQLError('Community not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const isSuperuser = dbUser.role === 'superuser';
    const membership = await ctx.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: args.communityId, userId: dbUser.id } },
    });
    if (!isSuperuser && (!membership || !['owner', 'admin'].includes(membership.role))) {
      throw new GraphQLError('Only community owners and admins can create albums', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

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
        communityId: args.communityId,
        title: title.trim(),
        description: description?.trim() || null,
        isPublic: isPublic ?? true,
      },
      include: {
        user: { include: { profile: true } },
        community: true,
        coverPhoto: { include: { variants: true } },
      },
    });
  },

  addPhotosToCommunityAlbum: async (
    _parent: unknown,
    args: { albumId: string; photoIds: string[] },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const album = await ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      select: { communityId: true },
    });
    if (!album) {
      throw new GraphQLError('Album not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    if (!album.communityId) {
      throw new GraphQLError('Use addPhotosToAlbum for personal albums', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const membership = await ctx.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: album.communityId, userId: dbUser.id } },
    });
    if (!membership || membership.status !== 'active') {
      throw new GraphQLError('You must be an active community member', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const photos = await ctx.prisma.photo.findMany({
      where: { id: { in: args.photoIds }, userId: dbUser.id },
      select: { id: true },
    });
    if (photos.length !== args.photoIds.length) {
      throw new GraphQLError('You can only add your own photos', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.albumPhoto.createMany({
      data: args.photoIds.map((photoId) => ({
        albumId: args.albumId,
        photoId,
      })),
      skipDuplicates: true,
    });

    return ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      include: {
        user: { include: { profile: true } },
        community: true,
        coverPhoto: { include: { variants: true } },
      },
    });
  },

  removePhotosFromCommunityAlbum: async (
    _parent: unknown,
    args: { albumId: string; photoIds: string[] },
    ctx: Context,
  ) => {
    const dbUser = await getDbUser(ctx);

    const album = await ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      select: { communityId: true },
    });
    if (!album) {
      throw new GraphQLError('Album not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    if (!album.communityId) {
      throw new GraphQLError('Use removePhotosFromAlbum for personal albums', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const isSuperuser = dbUser.role === 'superuser';
    const membership = await ctx.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: album.communityId, userId: dbUser.id } },
    });
    if (!isSuperuser && (!membership || !['owner', 'admin'].includes(membership.role))) {
      // Non-admins can only remove photos they added themselves
      const photos = await ctx.prisma.photo.findMany({
        where: { id: { in: args.photoIds }, userId: dbUser.id },
        select: { id: true },
      });
      if (photos.length !== args.photoIds.length) {
        throw new GraphQLError('You can only remove your own photos from community albums', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    await ctx.prisma.albumPhoto.deleteMany({
      where: { albumId: args.albumId, photoId: { in: args.photoIds } },
    });

    return ctx.prisma.album.findUnique({
      where: { id: args.albumId },
      include: {
        user: { include: { profile: true } },
        community: true,
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
    if (parent.communityId) {
      return ctx.prisma.albumPhoto.count({ where: { albumId: parent.id } });
    }
    return ctx.prisma.photo.count({ where: { albumId: parent.id } });
  },

  community: (parent: AlbumParent, _args: unknown, ctx: Context) => {
    if (!parent.communityId) return null;
    return ctx.prisma.community.findUnique({ where: { id: parent.communityId } });
  },

  myMembership: async (parent: AlbumParent, _args: unknown, ctx: Context) => {
    if (!parent.communityId) return null;
    const dbUser = await getDbUser(ctx);
    if (!dbUser) return null;
    return ctx.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: parent.communityId,
          userId: dbUser.id,
        },
      },
    });
  },

  photos: async (
    parent: AlbumParent,
    args: { first?: number; after?: string },
    ctx: Context,
  ) => {
    const take = Math.min(args.first ?? 20, 50);
    let items: Awaited<ReturnType<typeof ctx.prisma.photo.findMany>>;

    if (parent.communityId) {
      // Community album — use junction table to get photo IDs, then fetch photos
      const junctionEntries = await ctx.prisma.albumPhoto.findMany({
        where: { albumId: parent.id },
        orderBy: { addedAt: 'desc' },
        take: take + 1,
      });

      const photoIds = junctionEntries.map((e) => e.photoId);
      const hasNextPage = photoIds.length > take;
      const ids = photoIds.slice(0, take);

      if (ids.length === 0) {
        return {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 0,
        };
      }

      items = await ctx.prisma.photo.findMany({
        where: { id: { in: ids } },
        include: { user: true, variants: true, tags: true },
      });

      // Maintain junction order
      const itemMap = new Map(items.map((p) => [p.id, p]));
      const orderedItems = ids.map((id) => itemMap.get(id)!);

      const totalCount = await ctx.prisma.albumPhoto.count({ where: { albumId: parent.id } });
      const edges = orderedItems.map((p) => ({
        cursor: encodeCursor(p.createdAt),
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
    } else {
      // Personal album — use Photo.albumId
      const where: Record<string, unknown> = { albumId: parent.id };
      if (args.after) {
        where.createdAt = { lt: decodeCursor(args.after) };
      }

      const [photos, totalCount] = await Promise.all([
        ctx.prisma.photo.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: take + 1,
          include: { user: true, variants: true, tags: true },
        }),
        ctx.prisma.photo.count({ where: { albumId: parent.id } }),
      ]);

      const hasNextPage = photos.length > take;
      const edges = photos.slice(0, take).map((p) => ({
        cursor: encodeCursor(p.createdAt),
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
    }
  },
};
