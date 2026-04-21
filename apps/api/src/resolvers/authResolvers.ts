import { randomBytes, randomUUID } from 'node:crypto';

import { validateUsername } from '@spotterspace/shared';
import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';

import { signToken } from '../auth/jwt.js';
import type { Context } from '../context.js';
import {
  sendPasswordReminderEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/email.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

/**
 * Hashes a password using bcrypt with a per-user salt.
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a bcrypt hash.
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const authMutationResolvers = {
  signUp: async (
    _parent: unknown,
    args: { input: { email: string; username: string; password: string; displayName?: string } },
    ctx: Context,
  ) => {
    const { email, username, password, displayName } = args.input;

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

    const passwordHash = await hashPassword(password);
    const sub = randomUUID();

    try {
      const verificationToken = randomBytes(32).toString('base64url');
      const user = await ctx.prisma.user.create({
        data: {
          cognitoSub: sub,
          passwordHash,
          email,
          username,
          emailVerified: false,
          emailVerificationToken: verificationToken,
          profile: {
            create: {
              displayName: args.input.displayName || username,
            },
          },
        },
        include: { profile: true },
      });

      const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
      await sendVerificationEmail(email, username, verificationToken, baseUrl).catch((err) => {
        console.error('Failed to send verification email:', err);
      });

      return { user };
    } catch (err: unknown) {
      if (
        (err instanceof Error && err.message.includes('Unique constraint')) ||
        (err as { code?: string }).code === 'P2002'
      ) {
        throw new GraphQLError('A user with this email or username already exists', {
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

    const user = await ctx.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (user.status !== 'active') {
      throw new GraphQLError('Your account has been suspended or banned', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (!user.emailVerified) {
      throw new GraphQLError('Please verify your email before signing in', {
        extensions: { code: 'EMAIL_NOT_VERIFIED' },
      });
    }

    const token = signToken({ sub: user.cognitoSub, email, username: user.username });

    // Set HttpOnly cookie for browser clients
    ctx.res?.setHeader('Set-Cookie', [
      `access_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    ]);

    return { token, user };
  },

  requestPasswordReminder: async (_parent: unknown, args: { email: string }, ctx: Context) => {
    const { email } = args;

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    if (user) {
      await sendPasswordReminderEmail(email, user.username).catch((err) => {
        console.error('Failed to send password reminder email:', err);
      });
    }

    // Always return true — don't reveal whether user exists
    return true;
  },

  requestPasswordReset: async (_parent: unknown, args: { email: string }, ctx: Context) => {
    const { email } = args;

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await ctx.prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
      await sendPasswordResetEmail(email, token, baseUrl).catch((err) => {
        console.error('Failed to send password reset email:', err);
      });
    }

    // Always return true — don't reveal whether user exists
    return true;
  },

  resetPassword: async (
    _parent: unknown,
    args: { token: string; newPassword: string },
    ctx: Context,
  ) => {
    const { token, newPassword } = args;

    if (newPassword.length < 8) {
      throw new GraphQLError('Password must be at least 8 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const resetToken = await ctx.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { include: { profile: true } } },
    });

    if (!resetToken) {
      throw new GraphQLError('Invalid or expired token', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (resetToken.usedAt) {
      throw new GraphQLError('Token has already been used', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (resetToken.expiresAt < new Date()) {
      throw new GraphQLError('Token has expired', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const newPasswordHash = await hashPassword(newPassword);
    const newSub = randomUUID();

    const updatedUser = await ctx.prisma.user.update({
      where: { id: resetToken.userId },
      data: { cognitoSub: newSub, passwordHash: newPasswordHash },
      include: { profile: true },
    });

    // Mark token as used
    await ctx.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    const newToken = signToken({
      sub: newSub,
      email: updatedUser.email,
      username: updatedUser.username,
    });

    // Set HttpOnly cookie for browser clients
    ctx.res?.setHeader('Set-Cookie', [
      `access_token=${newToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    ]);

    return { token: newToken, user: updatedUser };
  },

  verifyEmail: async (_parent: unknown, args: { token: string }, ctx: Context) => {
    const { token } = args;

    const user = await ctx.prisma.user.findFirst({
      where: { emailVerificationToken: token },
      include: { profile: true },
    });

    if (!user) {
      throw new GraphQLError('Invalid verification token', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (user.emailVerified) {
      throw new GraphQLError('Email already verified', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const updatedUser = await ctx.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
      include: { profile: true },
    });

    const jwt = signToken({
      sub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    // Set HttpOnly cookie for browser clients
    ctx.res?.setHeader('Set-Cookie', [
      `access_token=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    ]);

    return { token: jwt, user: updatedUser };
  },
};
