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

// ─── Pagination Helpers ───────────────────────────────────────────────────────

export interface PaginationArgs {
  skip: number;
  take: number;
  cursorWhere?: Record<string, unknown>;
  /** True when using offset pagination (page arg), false when using keyset (after cursor) */
  isOffset: boolean;
}

/**
 * Build Prisma pagination args from page or cursor+first.
 * When page is provided → offset pagination via Prisma's `skip`.
 * When after cursor is provided → keyset pagination via where.createdAt < cursor.
 * Otherwise → simple first/take without cursor or skip.
 *
 * `maxTake` caps how many rows a single page may request (default 50). Resolvers
 * that legitimately need to load larger result sets (e.g. admin reference-data
 * dropdowns that must show every row) can pass a higher cap.
 */
export function buildPaginationArgs({
  first,
  after,
  page,
  maxTake = 50,
}: {
  first?: number;
  after?: string;
  page?: number;
  maxTake?: number;
}): PaginationArgs {
  const take = Math.min(first ?? 20, maxTake);

  if (page != null && page > 0) {
    return { skip: (page - 1) * take, take, cursorWhere: undefined, isOffset: true };
  }

  if (after) {
    return {
      skip: 0,
      take,
      cursorWhere: { createdAt: { lt: decodeCursor(after) } },
      isOffset: false,
    };
  }

  return { skip: 0, take, cursorWhere: undefined, isOffset: false };
}

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
