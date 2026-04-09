import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhotoParent {
  id: string;
  userId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const photoIncludes = { user: true, variants: true, tags: true } as const;

/**
 * Resolves the authenticated user's DB id from the context.
 * Throws NOT_FOUND if the user record doesn't exist.
 */
async function resolveUserId(ctx: Context): Promise<string> {
  const authUser = requireAuth(ctx);
  const user = await ctx.prisma.user.findUnique({
    where: { cognitoSub: authUser.sub },
    select: { id: true },
  });
  if (!user) {
    throw new GraphQLError('User not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  return user.id;
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const likeMutationResolvers = {
  likePhoto: async (
    _parent: unknown,
    args: { photoId: string },
    ctx: Context,
  ) => {
    const userId = await resolveUserId(ctx);

    // Verify photo exists
    const photo = await ctx.prisma.photo.findUnique({
      where: { id: args.photoId },
      select: { id: true },
    });
    if (!photo) {
      throw new GraphQLError('Photo not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Upsert-style: create if not already liked (idempotent)
    const existing = await ctx.prisma.like.findUnique({
      where: { userId_photoId: { userId, photoId: args.photoId } },
    });
    if (!existing) {
      await ctx.prisma.like.create({
        data: { userId, photoId: args.photoId },
      });
    }

    return ctx.prisma.photo.findUnique({
      where: { id: args.photoId },
      include: photoIncludes,
    });
  },

  unlikePhoto: async (
    _parent: unknown,
    args: { photoId: string },
    ctx: Context,
  ) => {
    const userId = await resolveUserId(ctx);

    // Verify photo exists
    const photo = await ctx.prisma.photo.findUnique({
      where: { id: args.photoId },
      select: { id: true },
    });
    if (!photo) {
      throw new GraphQLError('Photo not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Delete if exists, no-op if not (idempotent)
    await ctx.prisma.like.deleteMany({
      where: { userId, photoId: args.photoId },
    });

    return ctx.prisma.photo.findUnique({
      where: { id: args.photoId },
      include: photoIncludes,
    });
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const likeFieldResolvers = {
  isLikedByMe: async (parent: PhotoParent, _args: unknown, ctx: Context) => {
    if (!ctx.user) return false;

    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!user) return false;

    const like = await ctx.prisma.like.findUnique({
      where: { userId_photoId: { userId: user.id, photoId: parent.id } },
      select: { id: true },
    });
    return !!like;
  },
};
