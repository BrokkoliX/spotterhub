import { GraphQLError } from 'graphql';

import type { Context } from '../context.js';

/**
 * Ensures the current request is authenticated.
 * Throws an UNAUTHENTICATED GraphQL error if no valid user is in the context.
 *
 * @param ctx - The Apollo Server context.
 * @returns The authenticated user (sub, email, username).
 */
export function requireAuth(ctx: Context) {
  if (!ctx.user) {
    throw new GraphQLError('You must be logged in to perform this action', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.user;
}

/**
 * Ensures the current user has one of the specified roles.
 * Must be called after requireAuth or with a known-authenticated context.
 *
 * @param ctx - The Apollo Server context.
 * @param allowedRoles - Roles that are permitted.
 * @returns The authenticated user.
 */
export async function requireRole(
  ctx: Context,
  allowedRoles: string[],
) {
  const authUser = requireAuth(ctx);
  const dbUser = await ctx.prisma.user.findUnique({
    where: { cognitoSub: authUser.sub },
    select: { role: true },
  });
  if (!dbUser || !allowedRoles.includes(dbUser.role)) {
    throw new GraphQLError('You do not have permission to perform this action', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return authUser;
}
