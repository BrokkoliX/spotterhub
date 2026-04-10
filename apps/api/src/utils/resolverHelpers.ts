import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Cursor Helpers ──────────────────────────────────────────────────────────

/**
 * Encode a Date into a base64 cursor string for Relay-style pagination.
 */
export function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

/**
 * Decode a base64 cursor string back to a Date.
 * Throws a BAD_USER_INPUT GraphQL error if the cursor is invalid.
 */
export function decodeCursor(cursor: string): Date {
  const raw = Buffer.from(cursor, 'base64').toString('utf-8');
  const date = new Date(raw);
  if (isNaN(date.getTime())) {
    throw new GraphQLError('Invalid cursor', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  return date;
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/**
 * Resolves the authenticated user's DB id from the context.
 * Throws UNAUTHENTICATED if not logged in, NOT_FOUND if user record is missing.
 */
export async function resolveUserId(ctx: Context): Promise<string> {
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

/**
 * Resolves the authenticated user's DB record with id and role.
 * Use this when you need to check the user's role for authorization.
 */
export async function getDbUser(ctx: Context): Promise<{ id: string; role: string }> {
  const authUser = requireAuth(ctx);
  const dbUser = await ctx.prisma.user.findUnique({
    where: { cognitoSub: authUser.sub },
    select: { id: true, role: true },
  });
  if (!dbUser) {
    throw new GraphQLError('User not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  return dbUser;
}
