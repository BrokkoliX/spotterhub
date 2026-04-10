import { createHash } from 'node:crypto';

import { validateUsername } from '@spotterhub/shared';
import { GraphQLError } from 'graphql';

import { signToken } from '../auth/jwt.js';
import type { Context } from '../context.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Hashes a password using SHA-256.
 * This is a dev-only implementation. In production, passwords are
 * managed by AWS Cognito and never stored in the application database.
 */
function hashPassword(password: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Local auth is disabled in production — use AWS Cognito');
  }
  return createHash('sha256').update(password).digest('hex');
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const authMutationResolvers = {
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
};
