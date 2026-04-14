import { createHash } from 'node:crypto';

import { validateUsername } from '@spotterspace/shared';
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
    const sub = `dev1-${passwordHash.slice(0, 32)}`;

    try {
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
    } catch (err: unknown) {
      // Handle unique constraint violation on cognitoSub — means another user
      // already has this password (same hash). In dev mode this is rare but
      // possible if two users pick the same password.
      if (
        err instanceof Error &&
        err.message.includes('Unique constraint') ||
        (err as { code?: string }).code === 'P2002'
      ) {
        throw new GraphQLError('A user with this password already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      throw err;
    }
  },

  signIn: async (
    _parent: unknown,
    args: { input: { email: string; password: string } },
    ctx: Context,
  ) => {
    const { email, password } = args.input;
    const passwordHash = hashPassword(password);
    // Auth: derive sub from password for existing dev accounts (backwards compat)
    const sub = `dev-${passwordHash.slice(0, 32)}`;

    const user = await ctx.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // New accounts use dev1- prefix — derive expected sub from password hash
    const isNewDevSub = user.cognitoSub.startsWith('dev1-');
    if (isNewDevSub) {
      const expectedSub = `dev1-${passwordHash.slice(0, 32)}`;
      if (user.cognitoSub !== expectedSub) {
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
    } else if (!user.cognitoSub.startsWith('dev1-') && user.cognitoSub !== sub) {
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (user.status !== 'active') {
      throw new GraphQLError('Your account has been suspended or banned', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const token = signToken({ sub: user.cognitoSub, email, username: user.username });
    return { token, user };
  },
};
