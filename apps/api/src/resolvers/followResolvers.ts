import { GraphQLError } from 'graphql';
import type { FollowTargetType } from '@prisma/client';

import type { Context } from '../context.js';
import { decodeCursor, encodeCursor, resolveUserId } from '../utils/resolverHelpers.js';

import { createNotification } from './notificationResolvers.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserParent {
  id: string;
  cognitoSub?: string;
}

export interface AirportFollowParent {
  id: string;
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const followMutationResolvers = {
  // ── User follows ────────────────────────────────────────────────────────

  followUser: async (
    _parent: unknown,
    args: { userId: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);

    if (followerId === args.userId) {
      throw new GraphQLError('You cannot follow yourself', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const targetUser = await ctx.prisma.user.findUnique({
      where: { id: args.userId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const existing = await ctx.prisma.follow.findUnique({
      where: {
        followerId_targetType_followingId: {
          followerId,
          targetType: 'user',
          followingId: args.userId,
        },
      },
    });
    if (!existing) {
      await ctx.prisma.follow.create({
        data: {
          followerId,
          targetType: 'user',
          followingId: args.userId,
        },
      });

      // Notify the followed user
      const follower = await ctx.prisma.user.findUnique({
        where: { id: followerId },
        select: { username: true },
      });
      if (follower) {
        createNotification(ctx.prisma, {
          userId: args.userId,
          type: 'follow',
          title: '👤 New follower',
          body: `@${follower.username} started following you`,
          data: { followerId },
        }).catch(() => {});
      }
    }

    ctx.loaders.clearAll();
    return ctx.prisma.user.findUnique({
      where: { id: args.userId },
      include: { profile: true },
    });
  },

  unfollowUser: async (
    _parent: unknown,
    args: { userId: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);

    const targetUser = await ctx.prisma.user.findUnique({
      where: { id: args.userId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.follow.deleteMany({
      where: {
        followerId,
        targetType: 'user',
        followingId: args.userId,
      },
    });

    ctx.loaders.clearAll();
    return ctx.prisma.user.findUnique({
      where: { id: args.userId },
      include: { profile: true },
    });
  },

  // ── Airport follows ─────────────────────────────────────────────────────

  followAirport: async (
    _parent: unknown,
    args: { airportId: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);

    const airport = await ctx.prisma.airport.findUnique({
      where: { id: args.airportId },
    });
    if (!airport) {
      throw new GraphQLError('Airport not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const existing = await ctx.prisma.follow.findUnique({
      where: {
        followerId_targetType_airportId: {
          followerId,
          targetType: 'airport',
          airportId: args.airportId,
        },
      },
    });
    if (!existing) {
      await ctx.prisma.follow.create({
        data: {
          followerId,
          targetType: 'airport',
          airportId: args.airportId,
        },
      });
    }

    return airport;
  },

  unfollowAirport: async (
    _parent: unknown,
    args: { airportId: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);

    const airport = await ctx.prisma.airport.findUnique({
      where: { id: args.airportId },
    });
    if (!airport) {
      throw new GraphQLError('Airport not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await ctx.prisma.follow.deleteMany({
      where: {
        followerId,
        targetType: 'airport',
        airportId: args.airportId,
      },
    });

    return airport;
  },

  // ── Topic follows (manufacturer, family, variant) ────────────────────────

  followTopic: async (
    _parent: unknown,
    args: { targetType: string; value: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);
    const { targetType, value } = args;

    const validTopicTypes = ['manufacturer', 'family', 'variant'];
    if (!validTopicTypes.includes(targetType)) {
      throw new GraphQLError(
        'targetType must be "manufacturer", "family", or "variant"',
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    const typedTargetType = targetType as FollowTargetType;
    const trimmed = value.trim();
    if (!trimmed) {
      throw new GraphQLError('value cannot be empty', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const existing = await ctx.prisma.follow.findUnique({
      where: {
        followerId_targetType_targetValue: {
          followerId,
          targetType: typedTargetType,
          targetValue: trimmed,
        },
      },
    });
    if (!existing) {
      await ctx.prisma.follow.create({
        data: {
          followerId,
          targetType: typedTargetType,
          targetValue: trimmed,
        },
      });
    }

    return { targetType, value: trimmed };
  },

  unfollowTopic: async (
    _parent: unknown,
    args: { targetType: string; value: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);
    const { targetType, value } = args;

    const validTopicTypes = ['manufacturer', 'family', 'variant'];
    if (!validTopicTypes.includes(targetType)) {
      throw new GraphQLError(
        'targetType must be "manufacturer", "family", or "variant"',
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    const typedTargetType = targetType as FollowTargetType;
    await ctx.prisma.follow.deleteMany({
      where: {
        followerId,
        targetType: typedTargetType,
        targetValue: value.trim(),
      },
    });

    return { targetType, value: value.trim() };
  },
};

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const followQueryResolvers = {
  followingFeed: async (
    _parent: unknown,
    args: { first?: number; after?: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);
    const take = Math.min(args.first ?? 20, 50);

    // Gather all follows for the authenticated user
    const follows = await ctx.prisma.follow.findMany({
      where: { followerId },
      include: { airport: true },
    });

    if (follows.length === 0) {
      return { edges: [], pageInfo: { endCursor: null, hasNextPage: false }, totalCount: 0 };
    }

    // Build OR conditions
    const orConditions: Record<string, unknown>[] = [];

    const followedUserIds = follows
      .filter((f) => f.targetType === 'user' && f.followingId)
      .map((f) => f.followingId!);
    if (followedUserIds.length > 0) {
      orConditions.push({ userId: { in: followedUserIds } });
    }

    // For airport follows, match on both ICAO and IATA codes
    const followedAirportCodes = follows
      .filter((f) => f.targetType === 'airport' && f.airport)
      .flatMap((f) => {
        const codes: string[] = [f.airport!.icaoCode];
        if (f.airport!.iataCode) codes.push(f.airport!.iataCode);
        return codes;
      });
    if (followedAirportCodes.length > 0) {
      orConditions.push({
        airportCode: { in: followedAirportCodes, mode: 'insensitive' },
      });
    }

    const followedManufacturers = follows
      .filter((f) => f.targetType === 'manufacturer' && f.targetValue)
      .map((f) => f.targetValue!);
    if (followedManufacturers.length > 0) {
      orConditions.push({
        aircraft: { manufacturer: { name: { in: followedManufacturers, mode: 'insensitive' } } },
      });
    }

    const followedFamilies = follows
      .filter((f) => f.targetType === 'family' && f.targetValue)
      .map((f) => f.targetValue!);
    if (followedFamilies.length > 0) {
      orConditions.push({
        aircraft: { family: { name: { in: followedFamilies, mode: 'insensitive' } } },
      });
    }

    const followedVariants = follows
      .filter((f) => f.targetType === 'variant' && f.targetValue)
      .map((f) => f.targetValue!);
    if (followedVariants.length > 0) {
      orConditions.push({
        aircraft: { variant: { name: { in: followedVariants, mode: 'insensitive' } } },
      });
    }

    if (orConditions.length === 0) {
      return { edges: [], pageInfo: { endCursor: null, hasNextPage: false }, totalCount: 0 };
    }

    const where: Record<string, unknown> = {
      moderationStatus: 'approved',
      OR: orConditions,
    };

    if (args.after) {
      where.createdAt = { lt: decodeCursor(args.after) };
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
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        hasNextPage,
      },
      totalCount,
    };
  },

  myFollowing: async (
    _parent: unknown,
    args: { targetType?: string },
    ctx: Context,
  ) => {
    const followerId = await resolveUserId(ctx);

    const where: Record<string, unknown> = { followerId };
    if (args.targetType) {
      where.targetType = args.targetType;
    }

    const follows = await ctx.prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        following: { include: { profile: true } },
        airport: true,
      },
    });

    return follows.map((f) => ({
      id: f.id,
      targetType: f.targetType,
      user: f.following ?? null,
      airport: f.airport ?? null,
      targetValue: f.targetValue ?? null,
      createdAt: f.createdAt.toISOString(),
    }));
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const followFieldResolvers = {
  isFollowedByMe: async (parent: UserParent, _args: unknown, ctx: Context) => {
    if (!ctx.user) return false;

    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!user) return false;
    if (user.id === parent.id) return false;

    const follow = await ctx.prisma.follow.findUnique({
      where: {
        followerId_targetType_followingId: {
          followerId: user.id,
          targetType: 'user',
          followingId: parent.id,
        },
      },
      select: { id: true },
    });
    return !!follow;
  },
};

// ─── Airport Field Resolvers ────────────────────────────────────────────────

export const airportFollowFieldResolvers = {
  isFollowedByMe: async (
    parent: AirportFollowParent,
    _args: unknown,
    ctx: Context,
  ) => {
    if (!ctx.user) return false;

    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: ctx.user.sub },
      select: { id: true },
    });
    if (!user) return false;

    const follow = await ctx.prisma.follow.findUnique({
      where: {
        followerId_targetType_airportId: {
          followerId: user.id,
          targetType: 'airport',
          airportId: parent.id,
        },
      },
      select: { id: true },
    });
    return !!follow;
  },

  followerCount: async (
    parent: AirportFollowParent,
    _args: unknown,
    ctx: Context,
  ) => {
    return ctx.prisma.follow.count({
      where: { targetType: 'airport', airportId: parent.id },
    });
  },
};
