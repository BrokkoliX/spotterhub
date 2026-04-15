import { createHash } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Dev-mode password hash matching the API's hashPassword function.
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Seed the database with test users, profiles, and sample airports.
 */
async function main() {
  console.log('🌱 Seeding database...');

  // ─── Test Users ────────────────────────────────────────────────────────

  const testPassword = 'password123';
  const passwordHash = hashPassword(testPassword);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@spotterspace.dev' },
    update: {},
    create: {
      cognitoSub: `dev1-${passwordHash.slice(0, 32)}`,
      email: 'alice@spotterspace.dev',
      username: 'alice',
      role: 'user',
      emailVerified: true,
      profile: {
        create: {
          displayName: 'Alice Spotter',
          bio: 'Aviation enthusiast based in Seattle. Love catching heavy arrivals at SEA.',
          locationRegion: 'Pacific Northwest, USA',
          experienceLevel: 'advanced',
          gear: 'Canon R5 + RF 100-500mm',
          interests: ['commercial', 'widebody', 'cargo'],
          favoriteAircraft: ['A380', '747-8F', '787-9'],
          favoriteAirports: ['KSEA', 'KLAX', 'EGLL'],
        },
      },
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@spotterspace.dev' },
    update: {},
    create: {
      cognitoSub: `dev-${hashPassword('bobpass123').slice(0, 32)}`,
      email: 'bob@spotterspace.dev',
      username: 'bob-mod',
      role: 'moderator',
      emailVerified: true,
      profile: {
        create: {
          displayName: 'Bob the Moderator',
          bio: 'Community moderator and military aviation fan.',
          locationRegion: 'Southern California, USA',
          experienceLevel: 'professional',
          gear: 'Nikon Z9 + 200-600mm',
          interests: ['military', 'fighter', 'airshow'],
          favoriteAircraft: ['F-22', 'F-35', 'C-17'],
          favoriteAirports: ['KNKX', 'KEDW', 'KLSV'],
        },
      },
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@spotterspace.dev' },
    update: {},
    create: {
      cognitoSub: `dev-${hashPassword('adminpass123').slice(0, 32)}`,
      email: 'charlie@spotterspace.dev',
      username: 'charlie-admin',
      role: 'admin',
      emailVerified: true,
      profile: {
        create: {
          displayName: 'Charlie Admin',
          bio: 'Platform administrator.',
          locationRegion: 'London, UK',
          experienceLevel: 'professional',
        },
      },
    },
  });

  const superuser = await prisma.user.upsert({
    where: { email: 'robi_sz@yahoo.com' },
    update: {},
    create: {
      cognitoSub: `dev1-${hashPassword('superpass123').slice(0, 32)}`,
      email: 'robi_sz@yahoo.com',
      username: 'robi_sz',
      role: 'superuser',
      status: 'active',
      emailVerified: true,
      profile: {
        create: {
          displayName: 'Robbie',
          bio: 'Platform superuser.',
          experienceLevel: 'professional',
        },
      },
    },
  });

  console.log(`  ✅ Users: alice (user), bob-mod (moderator), charlie-admin (admin), robi_sz (superuser)`);

  // ─── Sample Airports ──────────────────────────────────────────────────

  const airports = [
    { icaoCode: 'KSEA', iataCode: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'US', latitude: 47.4502, longitude: -122.3088 },
    { icaoCode: 'KLAX', iataCode: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'US', latitude: 33.9425, longitude: -118.4081 },
    { icaoCode: 'KJFK', iataCode: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'US', latitude: 40.6413, longitude: -73.7781 },
    { icaoCode: 'EGLL', iataCode: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'GB', latitude: 51.4700, longitude: -0.4543 },
    { icaoCode: 'LFPG', iataCode: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'FR', latitude: 49.0097, longitude: 2.5479 },
    { icaoCode: 'RJTT', iataCode: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'JP', latitude: 35.5533, longitude: 139.7811 },
    { icaoCode: 'OMDB', iataCode: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'AE', latitude: 25.2532, longitude: 55.3657 },
    { icaoCode: 'VHHH', iataCode: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'HK', latitude: 22.3080, longitude: 113.9185 },
    { icaoCode: 'YSSY', iataCode: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'AU', latitude: -33.9461, longitude: 151.1772 },
    { icaoCode: 'EDDF', iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'DE', latitude: 50.0379, longitude: 8.5622 },
    { icaoCode: 'EHAM', iataCode: 'AMS', name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'NL', latitude: 52.3105, longitude: 4.7683 },
    { icaoCode: 'KATL', iataCode: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'US', latitude: 33.6407, longitude: -84.4277 },
    { icaoCode: 'KORD', iataCode: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'US', latitude: 41.9742, longitude: -87.9073 },
    { icaoCode: 'KSFO', iataCode: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'US', latitude: 37.6213, longitude: -122.3790 },
    { icaoCode: 'KNKX', iataCode: null, name: 'MCAS Miramar', city: 'San Diego', country: 'US', latitude: 32.8684, longitude: -117.1424 },
    { icaoCode: 'KEDW', iataCode: 'EDW', name: 'Edwards Air Force Base', city: 'Edwards', country: 'US', latitude: 34.9054, longitude: -117.8839 },
    { icaoCode: 'KLSV', iataCode: 'LSV', name: 'Nellis Air Force Base', city: 'Las Vegas', country: 'US', latitude: 36.2362, longitude: -115.0341 },
    { icaoCode: 'LEMD', iataCode: 'MAD', name: 'Adolfo Suárez Madrid-Barajas Airport', city: 'Madrid', country: 'ES', latitude: 40.4983, longitude: -3.5676 },
    { icaoCode: 'WSSS', iataCode: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'SG', latitude: 1.3644, longitude: 103.9915 },
    { icaoCode: 'ZBAA', iataCode: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'CN', latitude: 40.0801, longitude: 116.5846 },
  ];

  for (const airport of airports) {
    await prisma.airport.upsert({
      where: { icaoCode: airport.icaoCode },
      update: {},
      create: airport,
    });
  }

  console.log(`  ✅ Airports: ${airports.length} seeded`);

  // ─── Sample Follow Relationships ───────────────────────────────────────

  await prisma.follow.upsert({
    where: { followerId_targetType_followingId: { followerId: alice.id, targetType: 'user', followingId: bob.id } },
    update: {},
    create: { followerId: alice.id, targetType: 'user', followingId: bob.id },
  });

  await prisma.follow.upsert({
    where: { followerId_targetType_followingId: { followerId: bob.id, targetType: 'user', followingId: alice.id } },
    update: {},
    create: { followerId: bob.id, targetType: 'user', followingId: alice.id },
  });

  console.log(`  ✅ Follows: alice ↔ bob`);

  // ─── Sample Communities ─────────────────────────────────────────────────

  const spotterSpaceCommunity = await prisma.community.upsert({
    where: { slug: 'spotterspace' },
    update: {},
    create: {
      name: 'SpotterSpace Community',
      slug: 'spotterspace',
      description: 'The official SpotterSpace community for aviation photographers worldwide.',
      category: 'General',
      visibility: 'public',
      ownerId: alice.id,
    },
  });

  const pacificNwCommunity = await prisma.community.upsert({
    where: { slug: 'pacific-nw-spotters' },
    update: {},
    create: {
      name: 'Pacific NW Spotters',
      slug: 'pacific-nw-spotters',
      description: 'Aviation photographers based in the Pacific Northwest — Seattle, Portland, and beyond.',
      category: 'Regional',
      visibility: 'public',
      ownerId: bob.id,
    },
  });

  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: spotterSpaceCommunity.id, userId: alice.id } },
    update: {},
    create: { communityId: spotterSpaceCommunity.id, userId: alice.id, role: 'owner' },
  });
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: pacificNwCommunity.id, userId: alice.id } },
    update: {},
    create: { communityId: pacificNwCommunity.id, userId: alice.id, role: 'member' },
  });
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: spotterSpaceCommunity.id, userId: bob.id } },
    update: {},
    create: { communityId: spotterSpaceCommunity.id, userId: bob.id, role: 'moderator' },
  });
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: pacificNwCommunity.id, userId: bob.id } },
    update: {},
    create: { communityId: pacificNwCommunity.id, userId: bob.id, role: 'owner' },
  });

  console.log(`  ✅ Communities: spotterspace, pacific-nw-spotters`);

  // ─── Forum Categories ───────────────────────────────────────────────────

  const spotterHubGeneralCategory = await prisma.forumCategory.upsert({
    where: { communityId_slug: { communityId: spotterSpaceCommunity.id, slug: 'general' } },
    update: {},
    create: {
      communityId: spotterSpaceCommunity.id,
      name: 'General Discussion',
      description: 'Talk about anything aviation photography related.',
      slug: 'general',
      position: 0,
    },
  });

  const spotterHubGearCategory = await prisma.forumCategory.upsert({
    where: { communityId_slug: { communityId: spotterSpaceCommunity.id, slug: 'gear' } },
    update: {},
    create: {
      communityId: spotterSpaceCommunity.id,
      name: 'Gear & Technique',
      description: 'Discuss cameras, lenses, and shooting techniques.',
      slug: 'gear',
      position: 1,
    },
  });

  const pacificNwCategory = await prisma.forumCategory.upsert({
    where: { communityId_slug: { communityId: pacificNwCommunity.id, slug: 'general' } },
    update: {},
    create: {
      communityId: pacificNwCommunity.id,
      name: 'General',
      description: 'Pacific Northwest aviation photography discussion.',
      slug: 'general',
      position: 0,
    },
  });

  console.log(`  ✅ Forum categories: 3 created`);

  // ─── Forum Threads & Posts ─────────────────────────────────────────────

  const thread1Id = 'a1b2c3d4-0000-0000-0000-000000000001';
  await prisma.forumThread.upsert({
    where: { id: thread1Id },
    update: {},
    create: {
      id: thread1Id,
      categoryId: spotterHubGeneralCategory.id,
      authorId: charlie.id,
      title: 'Welcome to SpotterSpace — introduce yourself!',
      isPinned: true,
      postCount: 2,
    },
  });

  const post1Id = 'a1b2c3d4-0000-0000-0000-000000000011';
  await prisma.forumPost.upsert({
    where: { id: post1Id },
    update: {},
    create: {
      id: post1Id,
      threadId: thread1Id,
      authorId: charlie.id,
      body: "Welcome to SpotterSpace! This is the place to introduce yourself to the community. Tell us about your favorite aircraft, your home airport, or what got you into aviation photography.\n\nLooking forward to seeing your shots!",
    },
  });

  const post2Id = 'a1b2c3d4-0000-0000-0000-000000000012';
  await prisma.forumPost.upsert({
    where: { id: post2Id },
    update: {},
    create: {
      id: post2Id,
      threadId: thread1Id,
      authorId: alice.id,
      body: "Hey everyone! I'm Alice, based in Seattle. My favorite spot is the toll road at SEA — nothing beats a 747-8F departing over Mt. Rainier. Excited to be part of this community!",
    },
  });

  const thread2Id = 'a1b2c3d4-0000-0000-0000-000000000002';
  await prisma.forumThread.upsert({
    where: { id: thread2Id },
    update: {},
    create: {
      id: thread2Id,
      categoryId: spotterHubGearCategory.id,
      authorId: bob.id,
      title: 'Best lens for air shows? 200-600mm vs 100-400mm',
      postCount: 1,
    },
  });

  const post3Id = 'a1b2c3d4-0000-0000-0000-000000000013';
  await prisma.forumPost.upsert({
    where: { id: post3Id },
    update: {},
    create: {
      id: post3Id,
      threadId: thread2Id,
      authorId: bob.id,
      body: "Heading to Miramar Air Show next month. Currently torn between the Sony 200-600mm and the Canon 100-400mm + 1.4x extender. For fighter jets at close range it's easy but the heavy metal at 3000ft needs reach. What's everyone using?",
    },
  });

  const thread3Id = 'a1b2c3d4-0000-0000-0000-000000000003';
  await prisma.forumThread.upsert({
    where: { id: thread3Id },
    update: {},
    create: {
      id: thread3Id,
      categoryId: pacificNwCategory.id,
      authorId: bob.id,
      title: 'March 20th SEA Ops — A380 and 747 day',
      postCount: 1,
    },
  });

  const post4Id = 'a1b2c3d4-0000-0000-0000-000000000014';
  await prisma.forumPost.upsert({
    where: { id: post4Id },
    update: {},
    create: {
      id: post4Id,
      threadId: thread3Id,
      authorId: bob.id,
      body: 'Just got back from the toll road. Had an Emirates A380 and a Lufthansa 747-8 in the same 20-minute window. Light was absolutely perfect around 5pm. KSEA delivered today.',
    },
  });

  console.log(`  ✅ Forum threads & posts: 3 threads, 4 posts`);

  // ─── Community Events ───────────────────────────────────────────────────

  const event1Id = 'b2c3d4e5-0000-0000-0000-000000000001';
  await prisma.communityEvent.upsert({
    where: { id: event1Id },
    update: {},
    create: {
      id: event1Id,
      communityId: pacificNwCommunity.id,
      organizerId: bob.id,
      title: 'SEA Spotting Meetup — Spring 2026',
      description: 'Join us at the Mt. Rainier trail for a group spotting session. Bring your longest lenses! Weather dependent.',
      location: 'Mt. Rainier Viewpoint, Federal Way, WA',
      startsAt: new Date('2026-05-15T14:00:00Z'),
      endsAt: new Date('2026-05-15T18:00:00Z'),
      maxAttendees: 20,
    },
  });

  const event2Id = 'b2c3d4e5-0000-0000-0000-000000000002';
  await prisma.communityEvent.upsert({
    where: { id: event2Id },
    update: {},
    create: {
      id: event2Id,
      communityId: spotterSpaceCommunity.id,
      organizerId: alice.id,
      title: 'LAX Twilight Session',
      description: "Evening spotting at In-N-Out airfield. We'll be gathering near the fence on arrivals view. Bring your wide angles.",
      location: 'In-N-Out Burger, Los Angeles, CA',
      startsAt: new Date('2026-04-20T17:30:00Z'),
      endsAt: new Date('2026-04-20T20:30:00Z'),
      maxAttendees: 15,
    },
  });

  await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: event1Id, userId: alice.id } },
    update: {},
    create: { eventId: event1Id, userId: alice.id, status: 'going' },
  });
  await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: event2Id, userId: alice.id } },
    update: {},
    create: { eventId: event2Id, userId: alice.id, status: 'going' },
  });

  console.log(`  ✅ Community events: 2 events with RSVPs`);

  // ─── Clean up orphaned test users ──────────────────────────────────────

  await prisma.user.deleteMany({
    where: {
      email: { endsWith: '@example.com' },
    },
  });

  console.log(`  🧹 Cleaned up orphaned test users`);

  // ─── Sample Photos ────────────────────────────────────────────────────

  const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:4566';
  const S3_BUCKET = process.env.S3_BUCKET ?? 'spotterspace-photos';
  const s3Base = `${S3_ENDPOINT}/${S3_BUCKET}`;

  const samplePhotos = [
    {
      userId: alice.id,
      caption: 'Emirates A380 on final approach at LAX, golden hour light painting the fuselage.',
      aircraftTypeName: 'Airbus A380-800',
      airline: 'Emirates',
      airportCode: 'KLAX',
      takenAt: new Date('2026-03-15T17:42:00Z'),
      moderationStatus: 'approved' as const,
      tags: ['a380', 'emirates', 'lax', 'golden-hour', 'widebody'],
    },
    {
      userId: alice.id,
      caption: 'Alaska 737 MAX departing SEA with Mt. Rainier in the background.',
      aircraftTypeName: 'Boeing 737 MAX 9',
      airline: 'Alaska Airlines',
      airportCode: 'KSEA',
      takenAt: new Date('2026-03-20T10:15:00Z'),
      moderationStatus: 'approved' as const,
      tags: ['737max', 'alaska', 'sea', 'mountain', 'departure'],
    },
    {
      userId: bob.id,
      caption: 'F-22 Raptor demo at Miramar Air Show — afterburner climb!',
      aircraftTypeName: 'Lockheed Martin F-22 Raptor',
      airline: 'USAF',
      airportCode: 'KNKX',
      takenAt: new Date('2026-02-28T14:30:00Z'),
      moderationStatus: 'approved' as const,
      tags: ['f22', 'raptor', 'military', 'airshow', 'afterburner'],
    },
    {
      userId: bob.id,
      caption: 'Lufthansa 747-8 pushing back at Frankfurt, morning fog.',
      aircraftTypeName: 'Boeing 747-8i',
      airline: 'Lufthansa',
      airportCode: 'EDDF',
      takenAt: new Date('2026-01-10T07:00:00Z'),
      moderationStatus: 'approved' as const,
      tags: ['747', 'lufthansa', 'frankfurt', 'fog', 'widebody'],
    },
    {
      userId: alice.id,
      caption: 'Singapore Airlines A350 taxiing at Changi — love this livery.',
      aircraftTypeName: 'Airbus A350-900',
      airline: 'Singapore Airlines',
      airportCode: 'WSSS',
      takenAt: new Date('2026-03-01T09:20:00Z'),
      moderationStatus: 'approved' as const,
      tags: ['a350', 'singapore-airlines', 'changi', 'livery'],
    },
    {
      userId: charlie.id,
      caption: 'British Airways A350 arriving at Heathrow on 27L.',
      aircraftTypeName: 'Airbus A350-1000',
      airline: 'British Airways',
      airportCode: 'EGLL',
      takenAt: new Date('2026-02-14T16:45:00Z'),
      moderationStatus: 'approved' as const,
      tags: ['a350', 'british-airways', 'heathrow', 'arrival'],
    },
  ];

  const createdPhotos = [];
  for (let i = 0; i < samplePhotos.length; i++) {
    const { tags, ...photoData } = samplePhotos[i];
    const photoId = crypto.randomUUID();

    const photo = await prisma.photo.upsert({
      where: { id: photoId },
      update: {},
      create: {
        id: photoId,
        ...photoData,
        originalUrl: `${s3Base}/uploads/${photoData.userId}/${photoId}.jpg`,
        originalWidth: 6000,
        originalHeight: 4000,
        fileSizeBytes: 8_500_000 + i * 500_000,
        mimeType: 'image/jpeg',
      },
    });

    // Create variants (display + thumbnail)
    await prisma.photoVariant.createMany({
      data: [
        {
          photoId: photo.id,
          variantType: 'display',
          url: `${s3Base}/variants/${photo.userId}/${photo.id}-display.jpg`,
          width: 1920,
          height: 1280,
          fileSizeBytes: 450_000,
        },
        {
          photoId: photo.id,
          variantType: 'thumbnail',
          url: `${s3Base}/variants/${photo.userId}/${photo.id}-thumbnail.jpg`,
          width: 400,
          height: 267,
          fileSizeBytes: 35_000,
        },
      ],
      skipDuplicates: true,
    });

    // Create tags
    if (tags.length > 0) {
      await prisma.photoTag.createMany({
        data: tags.map((tag) => ({ photoId: photo.id, tag })),
        skipDuplicates: true,
      });
    }

    createdPhotos.push(photo);
  }

  console.log(`  ✅ Photos: ${createdPhotos.length} with variants and tags`);

  // ─── Sample Comments ──────────────────────────────────────────────────

  if (createdPhotos.length >= 2) {
    const comment1 = await prisma.comment.create({
      data: {
        userId: bob.id,
        photoId: createdPhotos[0].id,
        body: 'Incredible shot! The light on the A380 is stunning.',
      },
    });

    await prisma.comment.create({
      data: {
        userId: alice.id,
        photoId: createdPhotos[0].id,
        body: 'Thanks! I waited 2 hours for the right light.',
        parentCommentId: comment1.id,
      },
    });

    await prisma.comment.create({
      data: {
        userId: alice.id,
        photoId: createdPhotos[2].id,
        body: 'That afterburner shot is insane 🔥',
      },
    });

    await prisma.comment.create({
      data: {
        userId: charlie.id,
        photoId: createdPhotos[3].id,
        body: 'The fog gives it such a moody atmosphere. Great composition!',
      },
    });

    console.log(`  ✅ Comments: 4 sample comments with 1 reply`);
  }

  // ─── Sample Likes ─────────────────────────────────────────────────────

  const likePairs = [
    { userId: bob.id, photoId: createdPhotos[0]?.id },
    { userId: charlie.id, photoId: createdPhotos[0]?.id },
    { userId: alice.id, photoId: createdPhotos[2]?.id },
    { userId: alice.id, photoId: createdPhotos[3]?.id },
    { userId: bob.id, photoId: createdPhotos[4]?.id },
    { userId: charlie.id, photoId: createdPhotos[1]?.id },
  ].filter((p) => p.photoId);

  for (const pair of likePairs) {
    await prisma.like.upsert({
      where: { userId_photoId: { userId: pair.userId, photoId: pair.photoId } },
      update: {},
      create: pair,
    });
  }

  console.log(`  ✅ Likes: ${likePairs.length} sample likes`);

  // ─── Photo Locations (link photos to airports) ──────────────────────────

  const photosWithAirports = await prisma.photo.findMany({
    where: { airportCode: { not: null } },
    select: { id: true, airportCode: true },
  });

  let locationCount = 0;
  for (const photo of photosWithAirports) {
    if (!photo.airportCode) continue;

    const airport = await prisma.airport.findUnique({
      where: { icaoCode: photo.airportCode },
    });
    if (!airport) continue;

    await prisma.photoLocation.upsert({
      where: { photoId: photo.id },
      update: {},
      create: {
        photoId: photo.id,
        rawLatitude: airport.latitude,
        rawLongitude: airport.longitude,
        displayLatitude: airport.latitude,
        displayLongitude: airport.longitude,
        privacyMode: 'exact',
        airportId: airport.id,
      },
    });
    locationCount++;
  }

  console.log(`  ✅ Photo locations: ${locationCount} photos linked to airports`);

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
