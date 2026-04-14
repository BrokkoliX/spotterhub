import { Prisma } from '@spotterspace/db';

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

  searchAirports: async (
    _parent: unknown,
    args: { query: string; first?: number },
    ctx: Context,
  ) => {
    const q = args.query.trim();
    if (!q) return [];

    const take = Math.min(args.first ?? 8, 20);
    const words = q.split(/\s+/).filter(Boolean);

    const where = (
      words.length === 1
        ? {
            OR: [
              { icaoCode: { contains: words[0], mode: 'insensitive' } },
              { iataCode: { contains: words[0], mode: 'insensitive' } },
              { name: { contains: words[0], mode: 'insensitive' } },
              { city: { contains: words[0], mode: 'insensitive' } },
            ],
          }
        : {
            AND: words.map((word) => ({
              OR: [
                { icaoCode: { contains: word, mode: 'insensitive' } },
                { iataCode: { contains: word, mode: 'insensitive' } },
                { name: { contains: word, mode: 'insensitive' } },
                { city: { contains: word, mode: 'insensitive' } },
              ],
            })),
          }
    ) as Prisma.AirportWhereInput;

    return ctx.prisma.airport.findMany({
      where,
      select: { icaoCode: true, iataCode: true, name: true, city: true, country: true },
      orderBy: { icaoCode: 'asc' },
      take,
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
