/**
 * Bulk airport seeder — reads the OurAirports CSV and upserts into the DB
 * via batched raw SQL for maximum throughput (avoids N+1 Prisma upserts).
 *
 * Usage (from project root):
 *   npx tsx scripts/seed-airports.ts <path-to-csv>
 *
 * The CSV must have a header row with these columns (in any order):
 *   ident, iata, icao, name, longitude, latitude, country
 *
 * Rows with an ICAO code that is not exactly 4 characters are skipped.
 * Where the icao column is blank, the ident column is used as a fallback.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '@spotterspace/db';

const CHUNK_SIZE = 1000;

interface AirportRecord {
  icaoCode: string;
  iataCode: string | null;
  name: string;
  city: string | null;
  country: string;
  latitude: number;
  longitude: number;
}

/** Parse a single CSV line, respecting double-quoted fields with embedded commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    const next = line[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
  }
  fields.push(field);
  return fields;
}

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (cols[i] ?? '').trim();
    });
    return obj;
  });
}

function loadAirports(csvPath: string): AirportRecord[] {
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(raw);

  const records: AirportRecord[] = [];
  let skipped = 0;

  // Track seen IATA codes to avoid unique constraint violations (OurAirports has duplicates)
  const seenIata = new Set<string>();
  // Track seen ICAO codes to deduplicate
  const seenIcao = new Set<string>();

  for (const row of rows) {
    const icaoCode = (row['icao'] || row['ident'] || '').toUpperCase();
    if (!icaoCode || icaoCode.length !== 4) {
      skipped++;
      continue;
    }
    if (seenIcao.has(icaoCode)) {
      skipped++;
      continue;
    }
    seenIcao.add(icaoCode);

    const iataRaw = row['iata'] ?? '';
    let iataCode: string | null = null;
    if (iataRaw.length === 3 && !seenIata.has(iataRaw)) {
      iataCode = iataRaw;
      seenIata.add(iataRaw);
    }

    records.push({
      icaoCode,
      iataCode,
      name: row['name'] || 'Unknown',
      city: null,
      country: row['country'] || 'Unknown',
      latitude: parseFloat(row['latitude'] ?? '0') || 0,
      longitude: parseFloat(row['longitude'] ?? '0') || 0,
    });
  }

  if (skipped > 0) {
    console.log(`  Skipped ${skipped} rows (missing/invalid ICAO or duplicates)`);
  }
  return records;
}

async function insertChunk(chunk: AirportRecord[]): Promise<void> {
  const placeholders = chunk.map((_, i) => {
    const b = i * 7;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
  });

  const params: (string | number | null)[] = [];
  for (const r of chunk) {
    params.push(r.icaoCode, r.iataCode, r.name, r.city, r.country, r.latitude, r.longitude);
  }

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO airports (id, icao_code, iata_code, name, city, country, latitude, longitude, created_at)
    SELECT
      gen_random_uuid(),
      v.icao_code,
      v.iata_code,
      v.name,
      v.city,
      v.country,
      v.latitude::double precision,
      v.longitude::double precision,
      now()
    FROM (VALUES ${placeholders.join(',')}) AS v(icao_code, iata_code, name, city, country, latitude, longitude)
    `,
    ...params,
  );
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/seed-airports.ts <path-to-csv>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Reading airports from: ${resolvedPath}`);
  const airports = loadAirports(resolvedPath);
  console.log(`  Parsed ${airports.length} valid airport records`);

  const chunks: AirportRecord[][] = [];
  for (let i = 0; i < airports.length; i += CHUNK_SIZE) {
    chunks.push(airports.slice(i, i + CHUNK_SIZE));
  }

  console.log('  Truncating existing airports table...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE airports RESTART IDENTITY CASCADE');
  console.log('  Inserting in ' + chunks.length + ' chunks of ' + CHUNK_SIZE + ' rows...');

  let done = 0;
  for (let i = 0; i < chunks.length; i++) {
    await insertChunk(chunks[i]!);
    done += chunks[i]!.length;
    process.stdout.write(`\r  Progress: ${done}/${airports.length}`);
  }

  console.log('\nDone -- ' + done + ' airports inserted');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
