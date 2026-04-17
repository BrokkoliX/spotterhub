/**
 * Generate a draft CSV mapping from existing AircraftType data.
 * This provides a starting point for manual curation before running
 * the migration script.
 *
 * The script:
 * 1. Reads all AircraftType records
 * 2. Groups them by vendor (manufacturer)
 * 3. Groups by model prefix (family)
 * 4. Creates variant-level rows
 * 5. Outputs CSV files to prisma/data/ for review and editing
 *
 * Usage:
 *   npx tsx scripts/generate-aircraft-hierarchy-draft.ts
 *
 * After generation, review and edit the CSV files in prisma/data/
 * before running:
 *   npx tsx prisma/seed-aircraft-hierarchy.ts
 *   npx tsx prisma/migrate-aircraft-hierarchy.ts
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OUTPUT_DIR = join(process.cwd(), 'prisma', 'data');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── Manufacturer prefixes ─────────────────────────────────────────────────────

const VENDOR_PREFIXES: [string, string][] = [
  ['AIRBUS', 'Airbus'],
  ['BOEING', 'Boeing'],
  ['LOCKHEED MARTIN', 'Lockheed Martin'],
  ['LOCKHEED', 'Lockheed'],
  ['EMBRAER', 'Embraer'],
  ['BOMBARDIER', 'Bombardier'],
  ['ATR', 'ATR'],
  ['SAAB', 'Saab'],
  ['FOKKER', 'Fokker'],
  ['DASSAULT', 'Dassault'],
  ['GULFSTREAM', 'Gulfstream'],
  ['BEECHCRAFT', 'Beechcraft'],
  ['CESSNA', 'Cessna'],
  ['PILATUS', 'Pilatus'],
  ['SIKORSKY', 'Sikorsky'],
  ['BELL', 'Bell'],
  ['AGUSTAWESTLAND', 'AgustaWestland'],
  ['SUKHOI', 'Sukhoi'],
  ['TUPOLLEV', 'Tupolev'],
  ['ILYUSHIN', 'Ilyushin'],
  ['ANTONOV', 'Antonov'],
  ['BERIEV', 'Beriev'],
  ['AEROSPATIALE', 'Aerospatiale'],
  ['AERMACCHI', 'Aermacchi'],
  ['DORNIER', 'Dornier'],
  ['DE HAVILLAND', 'De Havilland'],
  ['BAE SYSTEMS', 'BAE Systems'],
  ['MITSUBISHI', 'Mitsubishi'],
  ['KAWASAKI', 'Kawasaki'],
  ['FAIRCHILD', 'Fairchild'],
  ['BRITISH AEROSPACE', 'British Aerospace'],
  ['MIKOYAN', 'Mikoyan'],
  ['YAKOVLEV', 'Yakovlev'],
  ['NORTHROP GRUMMAN', 'Northrop Grumman'],
  ['ROCKWELL', 'Rockwell'],
  ['DEWOITINE', 'Dewoitine'],
  ['VR-TEKNIKA', 'VR-Technika'],
  ['KUZNETSOV', 'Kuznetsov'],
  ['SPAD', 'SPAD'],
  ['VICKERS', 'Vickers'],
  ['DE HAVILLAND CANADA', 'De Havilland Canada'],
  ['BRITTEN-NORMAN', 'Britten-Norman'],
  ['AI(R)', 'Ai(R)'],
  ['AMA', 'AMA'],
  ['XIAN', 'Xi\'an'],
  ['CHENGDU', 'Chengdu'],
  ['HARBIN', 'Harbin'],
  ['SHANGHAI', 'Shanghai'],
  ['SHOCH', 'Shoch'],
  ['JUNEYAO', 'Juneyao'],
  ['NANCHANG', 'Nanchang'],
  ['CHENGDU AIRCRAFT', 'Chengdu Aircraft'],
  ['REPUBLIC', 'Republic'],
  ['DOAK', 'Doak'],
  ['GLENN L. MARTIN', 'Glenn L. Martin'],
  ['CONVAIR', 'Convair'],
  ['GRUMMAN', 'Grumman'],
  ['NORTH AMERICAN', 'North American'],
  ['DOUGLAS', 'Douglas'],
  ['CURTISS', 'Curtiss'],
];

function normalizeVendor(vendor: string): string {
  const upper = vendor.toUpperCase().trim();
  for (const [prefix, canonical] of VENDOR_PREFIXES) {
    if (upper.startsWith(prefix)) return canonical;
  }
  return vendor.trim();
}

function normalizeModel(model: string): { family: string; variant: string } {
  // Try to split model into family + variant
  // e.g., "737-86N" → family: "737", variant: "737-86N"
  // e.g., "A380-800" → family: "A380", variant: "A380-800"

  // Remove leading/trailing spaces
  model = model.trim();

  // For Airbus types: A320-200N → A320 family, A320-200N variant
  // Pattern: letter(s) + numbers optionally followed by -letter(s)
  const airbusMatch = model.match(/^(A\d{2,4})[- ]*(\d*[A-Z]*\d*[A-Z]*.*)?$/);
  if (airbusMatch) {
    const family = airbusMatch[1]; // e.g., A320
    const rest = airbusMatch[2]?.trim() || '';
    const variant = rest ? `${family}${rest}` : family;
    return { family, variant };
  }

  // For Boeing types: 737-86N → 737 family, 737-86N variant
  // 747-8i → 747-8 family, 747-8i variant
  const boeingMatch = model.match(/^(7\d{2})[- ]*(\d*[A-Z]*\d*[A-Z]*.*)?$/);
  if (boeingMatch) {
    const family = boeingMatch[1];
    const rest = boeingMatch[2]?.trim() || '';
    const variant = rest ? `${family}${rest}` : family;
    return { family, variant };
  }

  // For other manufacturers, use the whole model as family=variant initially
  // User will need to split manually
  const dashIdx = model.indexOf('-');
  if (dashIdx > 0 && dashIdx < 20) {
    const family = model.slice(0, dashIdx);
    const rest = model.slice(dashIdx + 1);
    // Only split if rest starts with a number (makes it a variant)
    if (/^\d/.test(rest)) {
      return { family, variant: model };
    }
  }

  return { family: model, variant: model };
}

async function main() {
  console.log('🔄 Generating draft aircraft hierarchy CSVs…\n');

  const types = await prisma.aircraftType.findMany({
    select: { id: true, icaoCode: true, iataCode: true, vendor: true, model: true },
    orderBy: [{ vendor: 'asc' }, { model: 'asc' }],
  });

  console.log(`  📦 Loaded ${types.length} AircraftType records`);

  // Group by vendor (manufacturer)
  const byVendor = new Map<string, typeof types>();
  for (const t of types) {
    const vendor = normalizeVendor(t.vendor);
    if (!byVendor.has(vendor)) byVendor.set(vendor, []);
    byVendor.get(vendor)!.push(t);
  }

  // Build manufacturer rows
  const manufacturerRows = Array.from(byVendor.keys())
    .filter(v => v !== 'Unknown')
    .sort()
    .map(name => `${name},`);

  // Build family and variant rows
  const familyRows: string[] = ['name,manufacturer_name']; // header
  const variantRows: string[] = ['name,family_name,aircraft_type_icao']; // header
  const seenFamilies = new Set<string>();

  for (const [vendor, vendorTypes] of byVendor) {
    if (vendor === 'Unknown') continue;

    // Group by normalized model family
    const byFamily = new Map<string, typeof types>();
    for (const t of vendorTypes) {
      const { family } = normalizeModel(t.model);
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family)!.push(t);
    }

    for (const [familyName, familyTypes] of byFamily) {
      // Family row
      const familyKey = `${vendor}|${familyName}`;
      if (!seenFamilies.has(familyKey)) {
        familyRows.push(`${familyName},${vendor}`);
        seenFamilies.add(familyKey);
      }

      // Variant rows
      for (const t of familyTypes) {
        const { variant } = normalizeModel(t.model);
        const icao = t.icaoCode || '';
        variantRows.push(`${variant},${familyName},${icao}`);
      }
    }
  }

  // Write CSVs
  const mfgPath = join(OUTPUT_DIR, 'manufacturers.csv');
  const famPath = join(OUTPUT_DIR, 'families.csv');
  const varPath = join(OUTPUT_DIR, 'variants.csv');

  writeFileSync(mfgPath, manufacturerRows.join('\n') + '\n');
  writeFileSync(famPath, familyRows.join('\n') + '\n');
  writeFileSync(varPath, variantRows.join('\n') + '\n');

  console.log(`\n  ✅ Draft CSVs written to ${OUTPUT_DIR}:`);
  console.log(`     manufacturers.csv — ${manufacturerRows.length} rows`);
  console.log(`     families.csv     — ${familyRows.length - 1} rows`);
  console.log(`     variants.csv     — ${variantRows.length - 1} rows`);
  console.log(`\n  ⚠️  These are DRAFT files — please review and edit before use!`);
  console.log(`  💡 The script used heuristic splitting (vendor/model prefixes).`);
  console.log(`     Manual review is especially needed for:`);
  console.log(`     - Family groupings (some may need merging/splitting)`);
  console.log(`     - Variant names (some may be redundant with family name)`);
  console.log(`     - Unknown vendors that need proper names`);
  console.log(`\n  Next steps:`);
  console.log(`    1. Edit the CSV files in ${OUTPUT_DIR}/`);
  console.log(`    2. Run: npx tsx prisma/seed-aircraft-hierarchy.ts`);
  console.log(`    3. Run: npx tsx prisma/migrate-aircraft-hierarchy.ts`);
  console.log(`    4. Review validation report`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
