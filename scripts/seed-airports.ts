/**
 * Airports table reseeder.
 *
 * Replaces the contents of the `airports` table with a fresh snapshot from
 * OurAirports (https://davidmegginson.github.io/ourairports-data) while
 * preserving every photo / spotting-location / follow that already pointed
 * at an airport, by re-stitching the relationships through the airport's
 * ICAO code (the natural key) under its new UUID.
 *
 * Strict filter: a row is kept only if
 *   - `type` ≠ "closed"
 *   - `icao_code` is non-empty
 *   - `icao_code` length is exactly 4
 *
 * The entire reseed runs inside a single Postgres transaction. If anything
 * fails (or `--dry-run` is passed) the transaction is rolled back, leaving
 * the database byte-identical to the pre-run state.
 *
 * Usage (from project root):
 *   # Live fetch from OurAirports, real run:
 *   npx tsx scripts/seed-airports.ts
 *
 *   # Live fetch, dry-run (rolls back, prints what it would do):
 *   npx tsx scripts/seed-airports.ts --dry-run
 *
 *   # Read from a local CSV instead of fetching:
 *   npx tsx scripts/seed-airports.ts --from-file ./airports.csv
 *
 * The local CSV must have a header row with these columns (in any order):
 *   ident, iata, icao, name, longitude, latitude, country
 * It is expected to have already had `type=closed` rows filtered out and
 * `country` resolved from `iso_country` to a full country name.
 */

// In local dev, load .env from the repo root. In production (ECS), env vars
// are injected by the task definition from AWS Secrets Manager, dotenv is
// not installed in the runtime image, and this require is intentionally
// soft-failed so the seeder still runs.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config');
} catch {
  // dotenv not installed (production image) — env vars come from ECS task def.
}
import fs from 'fs';
import path from 'path';

import { prisma } from '@spotterspace/db';
import type { Prisma } from '@spotterspace/db';

const OURAIRPORTS_AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OURAIRPORTS_COUNTRIES_URL = 'https://davidmegginson.github.io/ourairports-data/countries.csv';

const CHUNK_SIZE = 1000;
// Insert-heavy transaction; default 5s is far too short.
const TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;
const TRANSACTION_MAX_WAIT_MS = 60 * 1000;

// Sentinel used to force a transaction rollback at the end of a dry run.
class DryRunRollback extends Error {
  constructor() {
    super('dry-run rollback');
    this.name = 'DryRunRollback';
  }
}

interface AirportRecord {
  icaoCode: string;
  iataCode: string | null;
  name: string;
  city: string | null;
  country: string;
  latitude: number;
  longitude: number;
}

interface CliOptions {
  dryRun: boolean;
  fromFile: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, fromFile: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--from-file') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--from-file requires a path argument');
      }
      opts.fromFile = next;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        `Usage: seed-airports [--dry-run] [--from-file <path>]
  --dry-run         Roll back the transaction after computing the plan.
  --from-file PATH  Read CSV from PATH instead of fetching OurAirports.`,
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ─── CSV parsing ───────────────────────────────────────────────────────────

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

// ─── Data fetch ────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Builds the strict-ICAO airport list from a local file. The local format
 * already has `country` resolved (column "country") and `closed` rows pruned;
 * this is the format produced by `scripts/build-airports-csv.py`.
 */
function loadFromFile(csvPath: string): AirportRecord[] {
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(raw);

  const records: AirportRecord[] = [];
  const seenIcao = new Set<string>();
  const seenIata = new Set<string>();
  let skippedNoIcao = 0;
  let skippedDup = 0;

  for (const row of rows) {
    const icaoCode = (row['icao'] ?? '').toUpperCase().trim();
    // Strict filter: ICAO must be present and exactly 4 chars. No ident fallback.
    if (!icaoCode || icaoCode.length !== 4) {
      skippedNoIcao++;
      continue;
    }
    if (seenIcao.has(icaoCode)) {
      skippedDup++;
      continue;
    }
    seenIcao.add(icaoCode);

    let iataCode: string | null = null;
    const iataRaw = (row['iata'] ?? '').toUpperCase().trim();
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

  console.log(
    `  From file: ${records.length} valid records (skipped ${skippedNoIcao} no-ICAO, ${skippedDup} duplicates)`,
  );
  return records;
}

/**
 * Fetches `airports.csv` and `countries.csv` from OurAirports, joins them on
 * `iso_country`, drops `type=closed` rows, and applies the strict-ICAO filter.
 * Equivalent to scripts/build-airports-csv.py followed by loadFromFile, but
 * without the intermediate file.
 */
async function loadFromOurAirports(): Promise<AirportRecord[]> {
  console.log(`  Fetching ${OURAIRPORTS_AIRPORTS_URL}`);
  console.log(`  Fetching ${OURAIRPORTS_COUNTRIES_URL}`);
  const [airportsRaw, countriesRaw] = await Promise.all([
    fetchText(OURAIRPORTS_AIRPORTS_URL),
    fetchText(OURAIRPORTS_COUNTRIES_URL),
  ]);

  const countries = parseCsv(countriesRaw);
  const countryMap = new Map<string, string>();
  for (const row of countries) {
    const code = row['code'];
    const name = row['name'];
    if (code && name) countryMap.set(code, name);
  }

  const airports = parseCsv(airportsRaw);

  const records: AirportRecord[] = [];
  const seenIcao = new Set<string>();
  const seenIata = new Set<string>();
  let skippedClosed = 0;
  let skippedNoIcao = 0;
  let skippedDup = 0;

  for (const row of airports) {
    if (row['type'] === 'closed') {
      skippedClosed++;
      continue;
    }
    const icaoCode = (row['icao_code'] ?? '').toUpperCase().trim();
    // Strict filter: ICAO must be present and exactly 4 chars. No ident fallback.
    if (!icaoCode || icaoCode.length !== 4) {
      skippedNoIcao++;
      continue;
    }
    if (seenIcao.has(icaoCode)) {
      skippedDup++;
      continue;
    }
    seenIcao.add(icaoCode);

    let iataCode: string | null = null;
    const iataRaw = (row['iata_code'] ?? '').toUpperCase().trim();
    if (iataRaw.length === 3 && !seenIata.has(iataRaw)) {
      iataCode = iataRaw;
      seenIata.add(iataRaw);
    }

    const isoCountry = row['iso_country'] ?? '';
    const country = (countryMap.get(isoCountry) ?? isoCountry) || 'Unknown';

    records.push({
      icaoCode,
      iataCode,
      name: row['name'] || 'Unknown',
      city: null,
      country,
      latitude: parseFloat(row['latitude_deg'] ?? '0') || 0,
      longitude: parseFloat(row['longitude_deg'] ?? '0') || 0,
    });
  }

  console.log(
    `  From OurAirports: ${records.length} valid records (skipped ${skippedClosed} closed, ${skippedNoIcao} no-ICAO, ${skippedDup} duplicates)`,
  );
  return records;
}

// ─── Reseed transaction ────────────────────────────────────────────────────

interface ReseedSummary {
  airportsBefore: number;
  airportsAfter: number;
  followsBefore: number;
  followsRestored: number;
  followsOrphaned: number;
  photoLocationsLinkedBefore: number;
  photoLocationsRestored: number;
  photoLocationsOrphaned: number;
  spottingLocationsLinkedBefore: number;
  spottingLocationsRestored: number;
  spottingLocationsOrphaned: number;
  orphanedIcaoSample: string[];
}

async function reseed(records: AirportRecord[], dryRun: boolean): Promise<ReseedSummary> {
  let summary: ReseedSummary | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Snapshot existing references into temp tables. ON COMMIT DROP
        //    means they auto-clean whether we commit or roll back.
        await tx.$executeRawUnsafe(`
          CREATE TEMP TABLE _airport_follow_backup ON COMMIT DROP AS
          SELECT f.id AS follow_id,
                 f.follower_id,
                 f.target_type,
                 f.created_at,
                 a.icao_code
          FROM follows f
          JOIN airports a ON a.id = f.airport_id
          WHERE f.airport_id IS NOT NULL;
        `);
        await tx.$executeRawUnsafe(`
          CREATE TEMP TABLE _airport_photo_loc_backup ON COMMIT DROP AS
          SELECT pl.id AS photo_location_id,
                 a.icao_code
          FROM photo_locations pl
          JOIN airports a ON a.id = pl.airport_id
          WHERE pl.airport_id IS NOT NULL;
        `);
        await tx.$executeRawUnsafe(`
          CREATE TEMP TABLE _airport_spotting_loc_backup ON COMMIT DROP AS
          SELECT sl.id AS spotting_location_id,
                 a.icao_code
          FROM spotting_locations sl
          JOIN airports a ON a.id = sl.airport_id
          WHERE sl.airport_id IS NOT NULL;
        `);

        const followBackupCount = await tx.$queryRawUnsafe<{ c: bigint }[]>(
          'SELECT COUNT(*)::bigint AS c FROM _airport_follow_backup;',
        );
        const followsBefore = Number(followBackupCount[0]!.c);

        const photoLocBackupCount = await tx.$queryRawUnsafe<{ c: bigint }[]>(
          'SELECT COUNT(*)::bigint AS c FROM _airport_photo_loc_backup;',
        );
        const photoLocationsLinkedBefore = Number(photoLocBackupCount[0]!.c);

        const spottingLocBackupCount = await tx.$queryRawUnsafe<{ c: bigint }[]>(
          'SELECT COUNT(*)::bigint AS c FROM _airport_spotting_loc_backup;',
        );
        const spottingLocationsLinkedBefore = Number(spottingLocBackupCount[0]!.c);

        const airportsBeforeRows = await tx.$queryRawUnsafe<{ c: bigint }[]>(
          'SELECT COUNT(*)::bigint AS c FROM airports;',
        );
        const airportsBefore = Number(airportsBeforeRows[0]!.c);

        // 2. Clear FK columns / delete dependent rows so the airports wipe
        //    doesn't trip cascade rules. follows.airport_id is ON DELETE
        //    CASCADE, but we delete those rows ourselves so we have explicit
        //    control over the count.
        await tx.$executeRawUnsafe(
          'UPDATE photo_locations SET airport_id = NULL WHERE airport_id IS NOT NULL;',
        );
        await tx.$executeRawUnsafe(
          'UPDATE spotting_locations SET airport_id = NULL WHERE airport_id IS NOT NULL;',
        );
        await tx.$executeRawUnsafe("DELETE FROM follows WHERE target_type = 'airport';");

        // 3. Wipe airports.
        await tx.$executeRawUnsafe('DELETE FROM airports;');

        // 4. Bulk-insert the new airport rows in chunks. Each row gets a
        //    fresh UUID; we never reuse old IDs.
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          await insertChunk(tx, chunk);
        }

        const airportsAfterRows = await tx.$queryRawUnsafe<{ c: bigint }[]>(
          'SELECT COUNT(*)::bigint AS c FROM airports;',
        );
        const airportsAfter = Number(airportsAfterRows[0]!.c);

        // 5. Restore references by joining backups to fresh airports on
        //    icao_code. Rows whose ICAO is no longer present (because the
        //    OurAirports snapshot dropped them, or the strict filter excluded
        //    them) become orphans: photo_locations / spotting_locations keep
        //    the row but airport_id stays NULL; follows are not re-created.

        // 5a. follows
        await tx.$executeRawUnsafe(`
          INSERT INTO follows (id, follower_id, target_type, airport_id, created_at)
          SELECT b.follow_id, b.follower_id, b.target_type, a.id, b.created_at
          FROM _airport_follow_backup b
          JOIN airports a ON a.icao_code = b.icao_code;
        `);
        const followsRestoredRows = await tx.$queryRawUnsafe<{ c: bigint }[]>(`
          SELECT COUNT(*)::bigint AS c
          FROM _airport_follow_backup b
          JOIN airports a ON a.icao_code = b.icao_code;
        `);
        const followsRestored = Number(followsRestoredRows[0]!.c);
        const followsOrphaned = followsBefore - followsRestored;

        // 5b. photo_locations
        await tx.$executeRawUnsafe(`
          UPDATE photo_locations pl
          SET airport_id = a.id
          FROM _airport_photo_loc_backup b
          JOIN airports a ON a.icao_code = b.icao_code
          WHERE pl.id = b.photo_location_id;
        `);
        const photoLocationsRestoredRows = await tx.$queryRawUnsafe<{ c: bigint }[]>(`
          SELECT COUNT(*)::bigint AS c
          FROM _airport_photo_loc_backup b
          JOIN airports a ON a.icao_code = b.icao_code;
        `);
        const photoLocationsRestored = Number(photoLocationsRestoredRows[0]!.c);
        const photoLocationsOrphaned = photoLocationsLinkedBefore - photoLocationsRestored;

        // 5c. spotting_locations
        await tx.$executeRawUnsafe(`
          UPDATE spotting_locations sl
          SET airport_id = a.id
          FROM _airport_spotting_loc_backup b
          JOIN airports a ON a.icao_code = b.icao_code
          WHERE sl.id = b.spotting_location_id;
        `);
        const spottingLocationsRestoredRows = await tx.$queryRawUnsafe<{ c: bigint }[]>(`
          SELECT COUNT(*)::bigint AS c
          FROM _airport_spotting_loc_backup b
          JOIN airports a ON a.icao_code = b.icao_code;
        `);
        const spottingLocationsRestored = Number(spottingLocationsRestoredRows[0]!.c);
        const spottingLocationsOrphaned = spottingLocationsLinkedBefore - spottingLocationsRestored;

        // Sample the ICAO codes that disappeared, so the operator can sanity-
        // check whether the orphan count is expected. Capped at 20 codes.
        const orphanedIcaoRows = await tx.$queryRawUnsafe<{ icao_code: string }[]>(`
          SELECT DISTINCT icao_code
          FROM (
            SELECT icao_code FROM _airport_follow_backup
            UNION
            SELECT icao_code FROM _airport_photo_loc_backup
            UNION
            SELECT icao_code FROM _airport_spotting_loc_backup
          ) referenced
          WHERE NOT EXISTS (
            SELECT 1 FROM airports a WHERE a.icao_code = referenced.icao_code
          )
          ORDER BY icao_code
          LIMIT 20;
        `);
        const orphanedIcaoSample = orphanedIcaoRows.map((r) => r.icao_code);

        summary = {
          airportsBefore,
          airportsAfter,
          followsBefore,
          followsRestored,
          followsOrphaned,
          photoLocationsLinkedBefore,
          photoLocationsRestored,
          photoLocationsOrphaned,
          spottingLocationsLinkedBefore,
          spottingLocationsRestored,
          spottingLocationsOrphaned,
          orphanedIcaoSample,
        };

        if (dryRun) {
          // Force a rollback. The temp tables drop on rollback too.
          throw new DryRunRollback();
        }
      },
      {
        timeout: TRANSACTION_TIMEOUT_MS,
        maxWait: TRANSACTION_MAX_WAIT_MS,
      },
    );
  } catch (err) {
    if (err instanceof DryRunRollback) {
      // Expected: dry-run path. Summary was captured before the throw.
      if (!summary) throw new Error('dry-run completed but summary is missing');
      return summary;
    }
    throw err;
  }

  if (!summary) throw new Error('reseed completed but summary is missing');
  return summary;
}

async function insertChunk(tx: Prisma.TransactionClient, chunk: AirportRecord[]): Promise<void> {
  const placeholders = chunk.map((_, i) => {
    const b = i * 7;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
  });

  const params: (string | number | null)[] = [];
  for (const r of chunk) {
    params.push(r.icaoCode, r.iataCode, r.name, r.city, r.country, r.latitude, r.longitude);
  }

  await tx.$executeRawUnsafe(
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
    FROM (VALUES ${placeholders.join(',')})
      AS v(icao_code, iata_code, name, city, country, latitude, longitude)
    `,
    ...params,
  );
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function printSummary(summary: ReseedSummary, dryRun: boolean): void {
  const banner = dryRun ? 'DRY RUN — transaction rolled back' : 'COMMIT — changes applied';
  console.log('');
  console.log('═'.repeat(72));
  console.log(banner);
  console.log('═'.repeat(72));
  console.log('');
  console.log(`Airports         before: ${summary.airportsBefore}`);
  console.log(`Airports         after:  ${summary.airportsAfter}`);
  console.log('');
  console.log(`Follows          before: ${summary.followsBefore}`);
  console.log(
    `Follows          restored: ${summary.followsRestored}   orphaned: ${summary.followsOrphaned}`,
  );
  console.log('');
  console.log(`Photo locations  linked before: ${summary.photoLocationsLinkedBefore}`);
  console.log(
    `Photo locations  restored: ${summary.photoLocationsRestored}   orphaned: ${summary.photoLocationsOrphaned}`,
  );
  console.log('');
  console.log(`Spotting loc.    linked before: ${summary.spottingLocationsLinkedBefore}`);
  console.log(
    `Spotting loc.    restored: ${summary.spottingLocationsRestored}   orphaned: ${summary.spottingLocationsOrphaned}`,
  );
  console.log('');
  if (summary.orphanedIcaoSample.length > 0) {
    console.log(
      `Sample of orphaned ICAOs (no longer in OurAirports / strict filter): ${summary.orphanedIcaoSample.join(', ')}`,
    );
  } else {
    console.log('No orphaned ICAOs — every referenced airport survived the reseed.');
  }
  console.log('');
}

// ─── Entry point ───────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${opts.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(
    `Source: ${opts.fromFile ? 'file ' + path.resolve(opts.fromFile) : 'OurAirports (live fetch)'}`,
  );

  const records = opts.fromFile
    ? loadFromFile(path.resolve(opts.fromFile))
    : await loadFromOurAirports();

  if (records.length === 0) {
    console.error('No records to insert — refusing to wipe airports table.');
    process.exit(1);
  }

  console.log(`Reseeding airports (${records.length} records)…`);
  const summary = await reseed(records, opts.dryRun);
  printSummary(summary, opts.dryRun);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
