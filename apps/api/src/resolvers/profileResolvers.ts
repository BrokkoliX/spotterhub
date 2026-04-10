import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const profileMutationResolvers = {
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
};
