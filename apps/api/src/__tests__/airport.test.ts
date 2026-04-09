import { ApolloServer } from '@apollo/server';
import { prisma } from '@spotterhub/db';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import type { Context } from '../context.js';
import { resolvers } from '../resolvers.js';
import { typeDefs } from '../schema.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

let server: ApolloServer<Context>;

function createTestContext(user: Context['user'] = null): Context {
  return { prisma, user };
}

beforeAll(async () => {
  server = new ApolloServer<Context>({ typeDefs, resolvers });
  await server.start();
});

afterAll(async () => {
  await server.stop();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.follow.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.photoTag.deleteMany();
  await prisma.photoLocation.deleteMany();
  await prisma.photoVariant.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.album.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.communitySubscription.deleteMany();
  await prisma.community.deleteMany();
  await prisma.spottingLocation.deleteMany();
  await prisma.airport.deleteMany();
  await prisma.user.deleteMany();
});

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const GET_AIRPORTS = `
  query Airports {
    airports {
      id
      icaoCode
      iataCode
      name
      city
      country
      latitude
      longitude
      photoCount
    }
  }
`;

const GET_AIRPORT = `
  query Airport($code: String!) {
    airport(code: $code) {
      id
      icaoCode
      iataCode
      name
      city
      country
      latitude
      longitude
      photoCount
      spottingLocations {
        id
        name
        description
        accessNotes
      }
    }
  }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestAirport(overrides: Partial<{
  icaoCode: string;
  iataCode: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}> = {}) {
  return prisma.airport.create({
    data: {
      icaoCode: overrides.icaoCode ?? 'KSEA',
      iataCode: overrides.iataCode ?? 'SEA',
      name: overrides.name ?? 'Seattle-Tacoma International Airport',
      city: overrides.city ?? 'Seattle',
      country: overrides.country ?? 'US',
      latitude: overrides.latitude ?? 47.4502,
      longitude: overrides.longitude ?? -122.3088,
    },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('airports query', () => {
  it('returns all airports', async () => {
    await createTestAirport();
    await createTestAirport({
      icaoCode: 'KLAX', iataCode: 'LAX', name: 'Los Angeles International',
      city: 'Los Angeles', latitude: 33.9425, longitude: -118.4081,
    });

    const res = await server.executeOperation(
      { query: GET_AIRPORTS },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airports).toHaveLength(2);
    // Sorted by icaoCode asc
    expect(data.airports[0].icaoCode).toBe('KLAX');
    expect(data.airports[1].icaoCode).toBe('KSEA');
  });

  it('returns empty array when no airports exist', async () => {
    const res = await server.executeOperation(
      { query: GET_AIRPORTS },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airports).toHaveLength(0);
  });

  it('includes photoCount for each airport', async () => {
    const airport = await createTestAirport();
    const user = await prisma.user.create({
      data: { email: 'ap@example.com', username: 'apuser', cognitoSub: 'sub-ap' },
    });
    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        originalUrl: 'http://localhost:4566/test.jpg',
        mimeType: 'image/jpeg',
        moderationStatus: 'approved',
        airportCode: 'KSEA',
      },
    });
    await prisma.photoLocation.create({
      data: {
        photoId: photo.id,
        rawLatitude: airport.latitude,
        rawLongitude: airport.longitude,
        displayLatitude: airport.latitude,
        displayLongitude: airport.longitude,
        airportId: airport.id,
      },
    });

    const res = await server.executeOperation(
      { query: GET_AIRPORTS },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airports[0].photoCount).toBe(1);
  });
});

describe('airport query', () => {
  it('finds airport by ICAO code', async () => {
    await createTestAirport();

    const res = await server.executeOperation(
      { query: GET_AIRPORT, variables: { code: 'KSEA' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airport).not.toBeNull();
    expect(data.airport.icaoCode).toBe('KSEA');
    expect(data.airport.name).toBe('Seattle-Tacoma International Airport');
  });

  it('finds airport by IATA code', async () => {
    await createTestAirport();

    const res = await server.executeOperation(
      { query: GET_AIRPORT, variables: { code: 'SEA' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airport).not.toBeNull();
    expect(data.airport.icaoCode).toBe('KSEA');
  });

  it('is case-insensitive', async () => {
    await createTestAirport();

    const res = await server.executeOperation(
      { query: GET_AIRPORT, variables: { code: 'ksea' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airport).not.toBeNull();
  });

  it('returns null for non-existent code', async () => {
    const res = await server.executeOperation(
      { query: GET_AIRPORT, variables: { code: 'ZZZZ' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airport).toBeNull();
  });

  it('includes spottingLocations', async () => {
    const airport = await createTestAirport();
    const user = await prisma.user.create({
      data: { email: 'spot@example.com', username: 'spotter', cognitoSub: 'sub-spot' },
    });
    await prisma.spottingLocation.create({
      data: {
        airportId: airport.id,
        name: 'South Viewpoint',
        description: 'Great views of Runway 16R arrivals',
        accessNotes: 'Free parking available',
        latitude: 47.44,
        longitude: -122.31,
        createdById: user.id,
      },
    });

    const res = await server.executeOperation(
      { query: GET_AIRPORT, variables: { code: 'KSEA' } },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airport.spottingLocations).toHaveLength(1);
    expect(data.airport.spottingLocations[0].name).toBe('South Viewpoint');
    expect(data.airport.spottingLocations[0].description).toBe('Great views of Runway 16R arrivals');
    expect(data.airport.spottingLocations[0].accessNotes).toBe('Free parking available');
  });
});
