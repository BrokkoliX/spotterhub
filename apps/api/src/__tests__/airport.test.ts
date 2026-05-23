import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  cleanDatabase,
  createTestContext,
  prisma,
  setupTestServer,
  teardownTestServer,
} from './testHelpers.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

let server: Awaited<ReturnType<typeof setupTestServer>>;

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

// ─── GraphQL Operations ─────────────────────────────────────────────────────

const GET_AIRPORTS = `
  query Airports {
    airports {
      edges {
        node {
          id
          icaoCode
          iataCode
          name
          city
          latitude
          longitude
          photoCount
        }
      }
      totalCount
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

async function createTestAirport(
  overrides: Partial<{
    icaoCode: string;
    iataCode: string;
    name: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  }> = {},
) {
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
      icaoCode: 'KLAX',
      iataCode: 'LAX',
      name: 'Los Angeles International',
      city: 'Los Angeles',
      latitude: 33.9425,
      longitude: -118.4081,
    });

    const res = await server.executeOperation(
      { query: GET_AIRPORTS },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airports.edges).toHaveLength(2);
    expect(data.airports.totalCount).toBe(2);
    // Sorted by icaoCode asc
    expect(data.airports.edges[0].node.icaoCode).toBe('KLAX');
    expect(data.airports.edges[1].node.icaoCode).toBe('KSEA');
  });

  it('returns empty array when no airports exist', async () => {
    const res = await server.executeOperation(
      { query: GET_AIRPORTS },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airports.edges).toHaveLength(0);
    expect(data.airports.totalCount).toBe(0);
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
    expect(data.airports.edges[0].node.photoCount).toBe(1);
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
    expect(data.airport.spottingLocations[0].description).toBe(
      'Great views of Runway 16R arrivals',
    );
    expect(data.airport.spottingLocations[0].accessNotes).toBe('Free parking available');
  });
});

describe('airportsInBounds query', () => {
  const AIRPORTS_IN_BOUNDS = `
    query AirportsInBounds($swLat: Float!, $swLng: Float!, $neLat: Float!, $neLng: Float!, $first: Int) {
      airportsInBounds(swLat: $swLat, swLng: $swLng, neLat: $neLat, neLng: $neLng, first: $first) {
        id
        icaoCode
        iataCode
        name
        city
        country
        latitude
        longitude
      }
    }
  `;

  it('returns only airports within the bounding box', async () => {
    // Inside a Seattle-area bbox
    await createTestAirport({
      icaoCode: 'KSEA',
      iataCode: 'SEA',
      name: 'Seattle-Tacoma',
      latitude: 47.4502,
      longitude: -122.3088,
    });
    // Outside (London)
    await createTestAirport({
      icaoCode: 'EGLL',
      iataCode: 'LHR',
      name: 'Heathrow',
      latitude: 51.4775,
      longitude: -0.4614,
    });
    // Outside (Sydney)
    await createTestAirport({
      icaoCode: 'YSSY',
      iataCode: 'SYD',
      name: 'Sydney Kingsford Smith',
      latitude: -33.9399,
      longitude: 151.1753,
    });

    const res = await server.executeOperation(
      {
        query: AIRPORTS_IN_BOUNDS,
        variables: { swLat: 47.0, swLng: -123.0, neLat: 48.0, neLng: -122.0 },
      },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airportsInBounds).toHaveLength(1);
    expect(data.airportsInBounds[0].icaoCode).toBe('KSEA');
  });

  it('respects the first limit', async () => {
    await createTestAirport({
      icaoCode: 'KSEA',
      iataCode: 'SEA',
      name: 'Sea-Tac',
      latitude: 47.45,
      longitude: -122.31,
    });
    await createTestAirport({
      icaoCode: 'KBFI',
      iataCode: 'BFI',
      name: 'Boeing Field',
      latitude: 47.53,
      longitude: -122.3,
    });
    await createTestAirport({
      icaoCode: 'KPAE',
      iataCode: 'PAE',
      name: 'Paine Field',
      latitude: 47.91,
      longitude: -122.28,
    });

    const res = await server.executeOperation(
      {
        query: AIRPORTS_IN_BOUNDS,
        variables: { swLat: 47.0, swLng: -123.0, neLat: 48.0, neLng: -122.0, first: 2 },
      },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    expect(data.airportsInBounds).toHaveLength(2);
  });

  it('handles antimeridian-crossing viewports (swLng > neLng)', async () => {
    // Anchorage (just east of antimeridian, lng ≈ -150)
    await createTestAirport({
      icaoCode: 'PANC',
      iataCode: 'ANC',
      name: 'Anchorage',
      latitude: 61.1742,
      longitude: -149.9961,
    });
    // Tokyo Haneda (just west of antimeridian, lng ≈ +140)
    await createTestAirport({
      icaoCode: 'RJTT',
      iataCode: 'HND',
      name: 'Tokyo Haneda',
      latitude: 35.5523,
      longitude: 139.7798,
    });
    // London — outside any Pacific bbox, must NOT appear
    await createTestAirport({
      icaoCode: 'EGLL',
      iataCode: 'LHR',
      name: 'Heathrow',
      latitude: 51.4775,
      longitude: -0.4614,
    });

    // Pacific viewport: sw=(20, 130), ne=(70, -130). swLng > neLng signals
    // the antimeridian crossing.
    const res = await server.executeOperation(
      {
        query: AIRPORTS_IN_BOUNDS,
        variables: { swLat: 20, swLng: 130, neLat: 70, neLng: -130 },
      },
      { contextValue: createTestContext() },
    );

    const data = (res.body as any).singleResult.data;
    const codes = (data.airportsInBounds as Array<{ icaoCode: string }>)
      .map((a) => a.icaoCode)
      .sort();
    expect(codes).toEqual(['PANC', 'RJTT']);
  });
});
