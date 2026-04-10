import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateSpottingLocationInput {
  name: string;
  description?: string | null;
  accessNotes?: string | null;
  latitude: number;
  longitude: number;
  airportId: string;
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const spottingLocationMutationResolvers = {
  createSpottingLocation: async (
    _parent: unknown,
    args: { input: CreateSpottingLocationInput },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const { input } = args;

    // Verify the airport exists
    const airport = await ctx.prisma.airport.findUnique({
      where: { id: input.airportId },
      select: { id: true },
    });
    if (!airport) {
      throw new GraphQLError('Airport not found', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate coordinates
    if (input.latitude < -90 || input.latitude > 90) {
      throw new GraphQLError('Latitude must be between -90 and 90', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (input.longitude < -180 || input.longitude > 180) {
      throw new GraphQLError('Longitude must be between -180 and 180', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.prisma.spottingLocation.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        accessNotes: input.accessNotes?.trim() || null,
        latitude: input.latitude,
        longitude: input.longitude,
        airportId: input.airportId,
        createdById: user.id,
      },
      include: { createdBy: { include: { profile: true } } },
    });
  },

  deleteSpottingLocation: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });
    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const spot = await ctx.prisma.spottingLocation.findUnique({
      where: { id: args.id },
      select: { createdById: true },
    });
    if (!spot) {
      throw new GraphQLError('Spotting location not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    if (spot.createdById !== user.id) {
      throw new GraphQLError('You can only delete your own spotting locations', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await ctx.prisma.spottingLocation.delete({ where: { id: args.id } });
    return true;
  },
};
