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

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// ─── Helpers ────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creates a refresh token record in the DB and returns the raw token string.
 */
async function createRefreshToken(prisma: Context['prisma'], userId: string): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
  return token;
}

/**
 * Issues a new short-lived access token + rotates the refresh token cookie.
 * Called on sign-in, token refresh, and session extension.
 */
async function issueSession(
  ctx: Context,
  user: { id: string; cognitoSub: string; email: string; username: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signToken({
    sub: user.cognitoSub,
    email: user.email,
    username: user.username,
  });
  const refreshToken = await createRefreshToken(ctx.prisma, user.id);

  // Access token: short-lived HttpOnly cookie (1 hour)
  // Refresh token: long-lived HttpOnly cookie (7 days), used to obtain new access tokens
  // Both cookies set in a single setHeader call to avoid overwriting each other
  ctx.res?.setHeader('Set-Cookie', [
    `access_token=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ACCESS_TOKEN_MAX_AGE}`,
    `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${REFRESH_TOKEN_MAX_AGE}`,
  ]);

  return { accessToken, refreshToken };
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const authMutationResolvers = {
  signUp: async (
    _parent: unknown,
    args: { input: { email: string; username: string; password: string; displayName?: string } },
    ctx: Context,
  ) => {
    const { email, username, password } = args.input;

    const usernameError = validateUsername(username);
    if (usernameError) {
      throw new GraphQLError(usernameError, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (password.length < 8) {
      throw new GraphQLError('Password must be at least 8 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

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
      include: { profile: true, sellerProfile: true },
    });

    if (!user || !user.passwordHash) {
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remaining = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 1000 / 60);
      throw new GraphQLError(
        `Account temporarily locked due to too many failed attempts. Try again in ${remaining} minute(s).`,
        { extensions: { code: 'FORBIDDEN' } },
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      // Increment failed attempts; lock out for 15 minutes after 5 consecutive failures
      const attempts = user.failedAttempts + 1;
      const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: attempts, lockoutUntil },
      });
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

    // Reset failed attempts and lockout on successful sign-in
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockoutUntil: null },
    });

    // Rotate: delete all existing refresh tokens for this user before issuing a new one.
    // This invalidates any previously stolen tokens.
    await ctx.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    const { accessToken, refreshToken } = await issueSession(ctx, {
      id: user.id,
      cognitoSub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    return { token: accessToken, refreshToken, user };
  },

  /**
   * Exchange a valid refresh_token cookie for a new short-lived access token.
   * Implements token rotation: the old refresh token is deleted and a new one is issued.
   */
  refreshToken: async (_parent: unknown, _args: unknown, ctx: Context) => {
    const refreshTokenStr = (ctx.req as { cookies?: { refresh_token?: string } }).cookies
      ?.refresh_token;

    if (!refreshTokenStr) {
      throw new GraphQLError('Refresh token required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const record = await ctx.prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: { user: { include: { profile: true } } },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new GraphQLError('Refresh token expired or invalid', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const user = record.user;

    if (user.status !== 'active') {
      throw new GraphQLError('Your account has been suspended or banned', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Rotate: delete old refresh token, issue new session
    await ctx.prisma.refreshToken.delete({ where: { id: record.id } });

    const { accessToken, refreshToken: newRefreshToken } = await issueSession(ctx, {
      id: user.id,
      cognitoSub: user.cognitoSub,
      email: user.email,
      username: user.username,
    });

    return { token: accessToken, refreshToken: newRefreshToken, user };
  },

  signOut: async (_parent: unknown, _args: unknown, ctx: Context) => {
    // Delete all refresh tokens for this user (sign out all sessions)
    if (ctx.user) {
      const user = await ctx.prisma.user.findUnique({
        where: { cognitoSub: ctx.user.sub },
        select: { id: true },
      });
      if (user) {
        await ctx.prisma.refreshToken.deleteMany({
          where: { userId: user.id },
        });
      }
    } else {
      // Unauthenticated — delete the specific token from cookie if present
      const refreshTokenStr = (ctx.req as { cookies?: { refresh_token?: string } }).cookies
        ?.refresh_token;
      if (refreshTokenStr) {
        await ctx.prisma.refreshToken.deleteMany({
          where: { token: refreshTokenStr },
        });
      }
    }

    ctx.res?.setHeader('Set-Cookie', [
      `access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      `refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    ]);

    return true;
  },

  requestPasswordReminder: async (_parent: unknown, args: { email: string }, ctx: Context) => {
    const { email } = args;

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    if (user) {
      await sendPasswordReminderEmail(email, user.username).catch((err) => {
        console.error('Failed to send password reminder email:', err);
      });
    }

    return true;
  },

  requestPasswordReset: async (_parent: unknown, args: { email: string }, ctx: Context) => {
    const { email } = args;

    const user = await ctx.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Clean up any existing unused/expired tokens for this user before creating a new one
      await ctx.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      await ctx.prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
      await sendPasswordResetEmail(email, token, baseUrl).catch((err) => {
        console.error('Failed to send password reset email:', err);
      });
    }

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

    await ctx.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Clean up all expired/used tokens for this user (there should only be one at a time)
    await ctx.prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    });

    const { accessToken, refreshToken: newRefreshToken } = await issueSession(ctx, {
      id: updatedUser.id,
      cognitoSub: newSub,
      email: updatedUser.email,
      username: updatedUser.username,
    });

    return { token: accessToken, refreshToken: newRefreshToken, user: updatedUser };
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

    const { accessToken, refreshToken: newRefreshToken } = await issueSession(ctx, {
      id: updatedUser.id,
      cognitoSub: user.cognitoSub,
      email: updatedUser.email,
      username: updatedUser.username,
    });

    return { token: accessToken, refreshToken: newRefreshToken, user: updatedUser };
  },
};
