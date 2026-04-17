/**
 * Migrate existing Aircraft records to link them to the new
 * AircraftManufacturer → AircraftFamily → AircraftVariant hierarchy.
 *
 * Usage:
 *   npx tsx prisma/migrate-aircraft-hierarchy.ts
 *
 * This script is idempotent — it skips any Aircraft that already has
 * manufacturerId/familyId/variantId set.
 *
 * It reads from prisma/data/:
 *   - aircraft_hierarchy_mapping.csv — maps AircraftType ICAO code →
 *     manufacturer name, family name, variant name
 *   - airline_name_mapping.csv        — maps free-text airline name → Airline.name
 *
 * Format for aircraft_hierarchy_mapping.csv:
 *   aircraft_type_icao,manufacturer_name,family_name,variant_name
 *   B738,Boeing,737,737-86N
 *   A388,Airbus,A380,A380-800
 *
 * Format for airline_name_mapping.csv:
 *   airline_name,airline_icao
 *   American Airlines,AAL
 *   Emirates,UAE
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DATA_DIR = join(process.cwd(), 'prisma', 'data');

// ─── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSV(filepath: string): Record<string, string>[] {
  const text = readFileSync(filepath, 'utf-8');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const fields = line.split(',').map(f => f.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = fields[i] ?? ''; });
    return obj;
  });
}

// ─── Aircraft hierarchy mapping ────────────────────────────────────────────────

interface HierarchyMapping {
  aircraft_type_icao: string;
  manufacturer_name: string;
  family_name: string;
  variant_name: string;
}

async function loadHierarchyMapping(): Promise<Map<string, HierarchyMapping>> {
  const filepath = join(DATA_DIR, 'aircraft_hierarchy_mapping.csv');
  if (!existsSync(filepath)) {
    console.warn(`  ⚠️  ${filepath} not found — skipping hierarchy linking`);
    return new Map();
  }
  const rows = parseCSV(filepath) as HierarchyMapping[];
  const map = new Map<string, HierarchyMapping>();
  for (const row of rows) {
    if (!row.aircraft_type_icao) continue;
    map.set(row.aircraft_type_icao.toUpperCase(), row);
  }
  return map;
}

// ─── Airline name mapping ──────────────────────────────────────────────────────

interface AirlineMapping {
  airline_name: string;
  airline_icao?: string;
}

async function loadAirlineMapping(): Promise<Map<string, string>> {
  // Map: lowercase airline name → icaoCode
  const filepath = join(DATA_DIR, 'airline_name_mapping.csv');
  if (!existsSync(filepath)) {
    console.warn(`  ⚠️  ${filepath} not found — skipping airline linking`);
    return new Map();
  }
  const rows = parseCSV(filepath) as AirlineMapping[];
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.airline_name) continue;
    if (row.airline_icao) {
      map.set(row.airline_name.toLowerCase().trim(), row.airline_icao.toUpperCase().trim());
    }
  }
  return map;
}

// ─── Main migration ───────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Starting aircraft hierarchy migration…\n');

  // 1. Load mapping CSVs
  const hierarchyMap = await loadHierarchyMapping();
  const airlineMap = await loadAirlineMapping();

  console.log(`  📋 Loaded ${hierarchyMap.size} hierarchy mappings`);
  console.log(`  📋 Loaded ${airlineMap.size} airline name mappings\n`);

  // 2. Count baseline
  const totalAircraft = await prisma.aircraft.count();
  const alreadyLinked = await prisma.aircraft.count({
    where: { OR: [{ manufacturerId: { not: null } }, { familyId: { not: null } }, { variantId: { not: null } }] },
  });
  console.log(`  📊 Total Aircraft records: ${totalAircraft}`);
  console.log(`  📊 Already linked: ${alreadyLinked}`);
  console.log(`  📊 Need linking: ${totalAircraft - alreadyLinked}\n`);

  // 3. Fetch all Aircraft records that need linking (batch for memory efficiency)
  const BATCH_SIZE = 500;
  let processed = 0;
  let linked = 0;
  let airlineLinked = 0;
  let skipped = 0;
  const unmatchedIcao: string[] = [];
  const unmatchedAirlines: string[] = [];

  console.log('  Processing Aircraft records…');

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const aircraftBatch = await prisma.aircraft.findMany({
      where: {
        OR: [
          { manufacturerId: null, familyId: null, variantId: null },
        ],
      },
      select: {
        id: true,
        registration: true,
        aircraftType: true,
        aircraftTypeId: true,
        airline: true,
        airlineId: true,
      },
      skip: offset,
      take: BATCH_SIZE,
    });

    if (aircraftBatch.length === 0) break;

    for (const aircraft of aircraftBatch) {
      processed++;
      let aircraftLinked = false;
      let airlineLinkedForRecord = false;

      // ── Link to hierarchy ───────────────────────────────────────────────
      if (aircraft.manufacturerId === null) {
        // Try to find mapping
        let mapping: HierarchyMapping | undefined;

        if (aircraft.aircraftTypeId) {
          // Look up by AircraftType ICAO
          const at = await prisma.aircraftType.findUnique({ where: { id: aircraft.aircraftTypeId } });
          if (at?.icaoCode) {
            mapping = hierarchyMap.get(at.icaoCode.toUpperCase());
          }
          if (!mapping && at?.iataCode) {
            mapping = hierarchyMap.get(at.iataCode.toUpperCase());
          }
        }

        if (!mapping && aircraft.aircraftType) {
          // Try to fuzzy-match by aircraftType string (e.g., "Boeing 737-86N")
          // Extract ICAO-like code from aircraftType string
          const words = aircraft.aircraftType.split(' ');
          for (const word of words) {
            const upper = word.toUpperCase();
            if (hierarchyMap.has(upper)) {
              mapping = hierarchyMap.get(upper);
              break;
            }
          }
        }

        if (mapping) {
          // Resolve manufacturer, family, variant IDs
          const manufacturer = await prisma.aircraftManufacturer.findUnique({ where: { name: mapping.manufacturer_name } });
          const family = manufacturer
            ? await prisma.aircraftFamily.findFirst({ where: { name: mapping.family_name, manufacturerId: manufacturer.id } })
            : null;
          const variant = family
            ? await prisma.aircraftVariant.findFirst({ where: { name: mapping.variant_name, familyId: family.id } })
            : null;

          if (manufacturer && family && variant) {
            await prisma.aircraft.update({
              where: { id: aircraft.id },
              data: {
                manufacturerId: manufacturer.id,
                familyId: family.id,
                variantId: variant.id,
              },
            });
            aircraftLinked = true;
            linked++;
          } else {
            if (!manufacturer) unmatchedIcao.push(`[${aircraft.registration}] manufacturer "${mapping.manufacturer_name}" not found`);
            else if (!family) unmatchedIcao.push(`[${aircraft.registration}] family "${mapping.family_name}" not found`);
            else unmatchedIcao.push(`[${aircraft.registration}] variant "${mapping.variant_name}" not found`);
          }
        } else {
          // No mapping found — skip for manual review
          skipped++;
        }
      }

      // ── Link to airline ─────────────────────────────────────────────────
      if (aircraft.airline && aircraft.airlineId === null) {
        const airlineNameLower = aircraft.airline.toLowerCase().trim();
        const icao = airlineMap.get(airlineNameLower);

        if (icao) {
          const airline = await prisma.airline.findUnique({ where: { icaoCode: icao } });
          if (airline) {
            await prisma.aircraft.update({
              where: { id: aircraft.id },
              data: { airlineId: airline.id },
            });
            airlineLinkedForRecord = true;
            airlineLinked++;
          }
        } else {
          // Try direct name match on Airline table
          const airlineByName = await prisma.airline.findFirst({
            where: { name: { equals: aircraft.airline, mode: 'insensitive' } },
          });
          if (airlineByName) {
            await prisma.aircraft.update({
              where: { id: aircraft.id },
              data: { airlineId: airlineByName.id },
            });
            airlineLinkedForRecord = true;
            airlineLinked++;
          } else if (!unmatchedAirlines.includes(aircraft.airline)) {
            unmatchedAirlines.push(aircraft.airline);
          }
        }
      }
    }

    if (processed % 1000 === 0) {
      console.log(`  … processed ${processed} records`);
    }
  }

  console.log('\n  ─── Results ───────────────────────────────────────────');
  console.log(`  Total processed:    ${processed}`);
  console.log(`  Hierarchy linked:   ${linked}`);
  console.log(`  Airline linked:     ${airlineLinked}`);
  console.log(`  Skipped (no match):${skipped}`);

  // 4. Validation report
  console.log('\n  ─── Validation Report ────────────────────────────────');
  const afterLinked = await prisma.aircraft.count({
    where: { manufacturerId: { not: null } },
  });
  const afterAirlineLinked = await prisma.aircraft.count({
    where: { airlineId: { not: null }, airline: { not: null } },
  });
  const totalWithAirlineString = await prisma.aircraft.count({
    where: { airline: { not: null } },
  });
  const total = await prisma.aircraft.count();

  console.log(`  Total Aircraft:              ${total}`);
  console.log(`  With manufacturerId:        ${afterLinked} (${((afterLinked / total) * 100).toFixed(1)}%)`);
  console.log(`  With airlineId (of Airline strings): ${afterAirlineLinked} / ${totalWithAirlineString}`);

  if (unmatchedIcao.length > 0) {
    console.log(`\n  ⚠️  Unmatched hierarchy (${unmatchedIcao.length} — first 20):`);
    unmatchedIcao.slice(0, 20).forEach(m => console.log(`     ${m}`));
  }

  if (unmatchedAirlines.length > 0) {
    console.log(`\n  ⚠️  Unmatched airline names (${unmatchedAirlines.length} — first 20):`);
    unmatchedAirlines.slice(0, 20).forEach(a => console.log(`     ${a}`));
  }

  console.log('\n✅ Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
