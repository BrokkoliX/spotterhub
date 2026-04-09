import { createHash } from 'node:crypto';

import { validateUsername } from '@spotterhub/shared';
import { GraphQLError } from 'graphql';

import { signToken } from './auth/jwt.js';
import { requireAuth } from './auth/requireAuth.js';
import type { Context } from './context.js';
import {
  commentFieldResolvers,
  commentMutationResolvers,
  commentQueryResolvers,
} from './resolvers/commentResolvers.js';
import {
  airportFollowFieldResolvers,
  followFieldResolvers,
  followMutationResolvers,
  followQueryResolvers,
} from './resolvers/followResolvers.js';
import {
  likeFieldResolvers,
  likeMutationResolvers,
} from './resolvers/likeResolvers.js';
import {
  photoFieldResolvers,
  photoMutationResolvers,
  photoQueryResolvers,
} from './resolvers/photoResolvers.js';
import {
  airportFieldResolvers,
  airportQueryResolvers,
} from './resolvers/airportResolvers.js';
import {
  albumFieldResolvers,
  albumMutationResolvers,
  albumQueryResolvers,
} from './resolvers/albumResolvers.js';
import { reportMutationResolvers } from './resolvers/reportResolvers.js';
import { searchQueryResolvers } from './resolvers/searchResolvers.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Hashes a password using SHA-256.
 * This is a dev-only implementation. In production, passwords are
 * managed by AWS Cognito and never stored in the application database.
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Encodes a cursor from a createdAt date for Relay-style pagination.
 */
function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

/**
 * Decodes a base64-encoded cursor back to a Date.
 */
function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

// ─── Type definitions for resolver parent types ─────────────────────────────

interface UserParent {
  id: string;
  cognitoSub?: string;
}

// ─── Resolvers ──────────────────────────────────────────────────────────────

export const resolvers = {
  Query: {
    health: async (_parent: unknown, _args: unknown, ctx: Context) => {
      let dbConnected = false;
      try {
        await ctx.prisma.$queryRaw`SELECT 1`;
        dbConnected = true;
      } catch {
        // DB unreachable
      }
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        dbConnected,
      };
    },

    me: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) return null;
      return ctx.prisma.user.findUnique({
        where: { cognitoSub: ctx.user.sub },
        include: { profile: true },
      });
    },

    user: async (_parent: unknown, args: { username: string }, ctx: Context) => {
      const user = await ctx.prisma.user.findUnique({
        where: { username: args.username },
        include: { profile: true },
      });
      if (!user) return null;
      // If profile is private, only the owner can see it
      if (user.profile && !user.profile.isPublic) {
        if (!ctx.user || ctx.user.sub !== user.cognitoSub) {
          return null;
        }
      }
      return user;
    },

    users: async (
      _parent: unknown,
      args: { first: number; after?: string },
      ctx: Context,
    ) => {
      const take = Math.min(args.first ?? 20, 50);
      const where = args.after
        ? { createdAt: { lt: decodeCursor(args.after) } }
        : {};

      const [items, totalCount] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: take + 1,
          include: { profile: true },
        }),
        ctx.prisma.user.count(),
      ]);

      const hasNextPage = items.length > take;
      const edges = items.slice(0, take).map((user) => ({
        cursor: encodeCursor(user.createdAt),
        node: user,
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

    ...photoQueryResolvers,
    ...commentQueryResolvers,
    ...searchQueryResolvers,
    ...airportQueryResolvers,
    ...albumQueryResolvers,
    ...followQueryResolvers,
  },

  Mutation: {
    signUp: async (
      _parent: unknown,
      args: { input: { email: string; username: string; password: string } },
      ctx: Context,
    ) => {
      const { email, username, password } = args.input;

      // Validate username
      const usernameError = validateUsername(username);
      if (usernameError) {
        throw new GraphQLError(usernameError, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate password
      if (password.length < 8) {
        throw new GraphQLError('Password must be at least 8 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check for existing user
      const existing = await ctx.prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        const field = existing.email === email ? 'email' : 'username';
        throw new GraphQLError(`A user with this ${field} already exists`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // In dev mode, we store a hashed password in cognitoSub as a workaround.
      // In production, cognitoSub comes from AWS Cognito.
      const passwordHash = hashPassword(password);
      const sub = `dev-${passwordHash.slice(0, 32)}`;

      const user = await ctx.prisma.user.create({
        data: {
          cognitoSub: sub,
          email,
          username,
          profile: {
            create: {
              displayName: username,
            },
          },
        },
        include: { profile: true },
      });

      const token = signToken({ sub, email, username });
      return { token, user };
    },

    signIn: async (
      _parent: unknown,
      args: { input: { email: string; password: string } },
      ctx: Context,
    ) => {
      const { email, password } = args.input;
      const passwordHash = hashPassword(password);
      const sub = `dev-${passwordHash.slice(0, 32)}`;

      const user = await ctx.prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      if (!user || user.cognitoSub !== sub) {
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.status !== 'active') {
        throw new GraphQLError('Your account has been suspended or banned', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const token = signToken({ sub, email, username: user.username });
      return { token, user };
    },

    updateProfile: async (
      _parent: unknown,
      args: { input: Record<string, unknown> },
      ctx: Context,
    ) => {
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

      // Validate experienceLevel if provided
      const validLevels = ['beginner', 'intermediate', 'advanced', 'professional'];
      if (
        args.input.experienceLevel &&
        !validLevels.includes(args.input.experienceLevel as string)
      ) {
        throw new GraphQLError(
          `Invalid experience level. Must be one of: ${validLevels.join(', ')}`,
          { extensions: { code: 'BAD_USER_INPUT' } },
        );
      }

      return ctx.prisma.profile.upsert({
        where: { userId: user.id },
        update: args.input,
        create: {
          userId: user.id,
          ...args.input,
        },
      });
    },

    updateAvatar: async (
      _parent: unknown,
      args: { avatarUrl: string },
      ctx: Context,
    ) => {
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

      return ctx.prisma.profile.upsert({
        where: { userId: user.id },
        update: { avatarUrl: args.avatarUrl },
        create: { userId: user.id, avatarUrl: args.avatarUrl },
      });
    },

    ...photoMutationResolvers,
    ...likeMutationResolvers,
    ...followMutationResolvers,
    ...commentMutationResolvers,
    ...albumMutationResolvers,
    ...reportMutationResolvers,
  },

  User: {
    profile: (parent: UserParent, _args: unknown, ctx: Context) => {
      return ctx.prisma.profile.findUnique({
        where: { userId: parent.id },
      });
    },

    followerCount: (parent: UserParent, _args: unknown, ctx: Context) => {
      return ctx.prisma.follow.count({
        where: { targetType: 'user', followingId: parent.id },
      });
    },

    followingCount: (parent: UserParent, _args: unknown, ctx: Context) => {
      return ctx.prisma.follow.count({
        where: { targetType: 'user', followerId: parent.id },
      });
    },

    photoCount: (parent: UserParent, _args: unknown, ctx: Context) => {
      return ctx.prisma.photo.count({
        where: { userId: parent.id },
      });
    },

    ...followFieldResolvers,
  },

  Photo: {
    ...photoFieldResolvers,
    ...likeFieldResolvers,
  },

  Comment: commentFieldResolvers,

  Airport: {
    ...airportFieldResolvers,
    ...airportFollowFieldResolvers,
  },

  Album: albumFieldResolvers,
};
