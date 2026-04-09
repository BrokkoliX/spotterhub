import type { Context } from '../context.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AirportParent {
  id: string;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const airportQueryResolvers = {
  airports: async (_parent: unknown, _args: unknown, ctx: Context) => {
    return ctx.prisma.airport.findMany({
      orderBy: { icaoCode: 'asc' },
    });
  },

  airport: async (_parent: unknown, args: { code: string }, ctx: Context) => {
    const code = args.code.trim().toUpperCase();

    // Try ICAO first, then IATA
    const airport = await ctx.prisma.airport.findUnique({
      where: { icaoCode: code },
    });

    if (airport) return airport;

    return ctx.prisma.airport.findUnique({
      where: { iataCode: code },
    });
  },
};

// ─── Field Resolvers ────────────────────────────────────────────────────────

export const airportFieldResolvers = {
  photoCount: async (parent: AirportParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.photoLocation.count({
      where: { airportId: parent.id },
    });
  },

  spottingLocations: async (parent: AirportParent, _args: unknown, ctx: Context) => {
    return ctx.prisma.spottingLocation.findMany({
      where: { airportId: parent.id },
      include: { createdBy: { include: { profile: true } } },
      orderBy: { name: 'asc' },
    });
  },
};
