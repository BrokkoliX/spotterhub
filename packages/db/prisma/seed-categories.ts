import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PHOTO_CATEGORIES = [
  { name: 'cabin', label: 'Cabin', sortOrder: 1 },
  { name: 'cockpit', label: 'Cockpit', sortOrder: 2 },
  { name: 'exterior', label: 'Exterior', sortOrder: 3 },
  { name: 'nightshot', label: 'Nightshot', sortOrder: 4 },
  { name: 'landing', label: 'Landing', sortOrder: 5 },
  { name: 'takeoff', label: 'Takeoff', sortOrder: 6 },
  { name: 'ground', label: 'Ground', sortOrder: 7 },
  { name: 'accident', label: 'Accident', sortOrder: 8 },
  { name: 'museum', label: 'Museum', sortOrder: 9 },
  { name: 'delivery', label: 'Delivery', sortOrder: 10 },
  { name: 'test_flight', label: 'Test Flight', sortOrder: 11 },
];

const AIRCRAFT_SPECIFIC_CATEGORIES = [
  { name: 'vintage', label: 'Vintage', sortOrder: 1 },
  { name: 'classic', label: 'Classic', sortOrder: 2 },
  { name: 'small_prop', label: 'Small Prop', sortOrder: 3 },
  { name: 'regional_jet', label: 'Regional Jet', sortOrder: 4 },
  { name: 'narrowbody', label: 'Narrowbody', sortOrder: 5 },
  { name: 'widebody', label: 'Widebody', sortOrder: 6 },
  { name: 'cargo', label: 'Cargo', sortOrder: 7 },
  { name: 'military_transport', label: 'Military Transport', sortOrder: 8 },
  { name: 'military_fighter', label: 'Military Fighter', sortOrder: 9 },
  { name: 'helicopter', label: 'Helicopter', sortOrder: 10 },
  { name: 'ultralight', label: 'Ultralight', sortOrder: 11 },
  { name: 'amphibious', label: 'Amphibious', sortOrder: 12 },
  { name: 'seaplane', label: 'Seaplane', sortOrder: 13 },
  { name: 'test_delivery', label: 'Test/Delivery', sortOrder: 14 },
  { name: 'derivation', label: 'Derivation', sortOrder: 15 },
];

async function main() {
  console.log('🌱 Seeding categories...');

  // Seed photo categories
  for (const category of PHOTO_CATEGORIES) {
    await prisma.photoCategory.upsert({
      where: { name: category.name },
      update: { label: category.label, sortOrder: category.sortOrder },
      create: category,
    });
  }
  console.log(`  ✅ Photo categories: ${PHOTO_CATEGORIES.length} seeded`);

  // Seed aircraft-specific categories
  for (const category of AIRCRAFT_SPECIFIC_CATEGORIES) {
    await prisma.aircraftSpecificCategory.upsert({
      where: { name: category.name },
      update: { label: category.label, sortOrder: category.sortOrder },
      create: category,
    });
  }
  console.log(`  ✅ Aircraft-specific categories: ${AIRCRAFT_SPECIFIC_CATEGORIES.length} seeded`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
