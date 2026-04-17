/**
 * Seed AircraftType table from OpenFlights aircraft database.
 * License: Open Database License (ODbL) — requires attribution.
 * Source: https://raw.githubusercontent.com/jpatokal/openflights/master/data/planes.dat
 *
 * Usage:
 *   npx tsx prisma/seed-aircraft-types.ts
 *
 * OpenFlights format (comma-separated, quoted):
 *   "Full Aircraft Name","IATA code","ICAO code"
 * e.g.: "Airbus A380-800","388","A388"
 *
 * The OpenFlights dataset is a curated ~240 aircraft types — passenger and common cargo.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GITHUB_RAW =
  'https://raw.githubusercontent.com/jpatokal/openflights/master/data/planes.dat';

interface PlaneRecord {
  name: string;
  iata: string;
  icao: string;
}

function parseLine(line: string): PlaneRecord | null {
  // Format: "Name","IATA","ICAO"
  const stripped = line.trim();
  if (!stripped || stripped.startsWith('#')) return null;

  // Simple quoted-field CSV parser
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of stripped) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());

  if (fields.length < 3) return null;

  const name = fields[0].replace(/^"|"$/g, '').trim();
  const iata = fields[1].replace(/^"|"$/g, '').trim();
  const icao = fields[2].replace(/^"|"$/g, '').trim();

  if (!name) return null;

  return { name, iata, icao };
}

function splitAircraftName(name: string): { vendor: string; model: string } {
  // Common manufacturer prefixes to try
  const prefixes = [
    'Airbus ',
    'Boeing ',
    'Lockheed ',
    'Lockheed Martin ',
    'Embraer ',
    'Bombardier ',
    'ATR ',
    'Saab ',
    'Fokker ',
    'Dassault ',
    'Gulfstream ',
    'Beechcraft ',
    'Cessna ',
    'Piper ',
    'Pilatus ',
    'Sikorsky ',
    'Bell ',
    'AgustaWestland ',
    'Sukhoi ',
    'Tupolev ',
    'Ilyushin ',
    'Antonov ',
    'Beriev ',
    'Aerospatiale ',
    'Aermacchi ',
    'Dornier ',
    'De Havilland ',
    'BAE Systems ',
    'Dassault Aviation ',
    'Mitsubishi ',
    'Kawasaki ',
    'Kawasaki Heavy Industries ',
    'Fairchild ',
    'British Aerospace ',
    'Daimler ',
    'Alenia ',
    'Aerojet ',
    'Aermachi ',
    'Sud Aviation ',
    'Nord ',
    'Dassault Electronique ',
    'Mikoyan ',
    'Yakovlev ',
    'Ilyushin ',
    'Antonov ',
    'Beriev ',
  ];

  for (const prefix of prefixes) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      return {
        vendor: name.slice(0, prefix.length),
        model: name.slice(prefix.length).trim(),
      };
    }
  }

  // No known prefix — try to split on first space
  const firstSpace = name.indexOf(' ');
  if (firstSpace > 0 && firstSpace < 20) {
    return {
      vendor: name.slice(0, firstSpace),
      model: name.slice(firstSpace + 1).trim(),
    };
  }

  return { vendor: 'Unknown', model: name };
}

async function fetchPlanes(): Promise<PlaneRecord[]> {
  const response = await fetch(GITHUB_RAW);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenFlights data: ${response.status}`);
  }
  const text = await response.text();
  const planes: PlaneRecord[] = [];

  for (const line of text.split('\n')) {
    const parsed = parseLine(line);
    if (parsed) planes.push(parsed);
  }

  return planes;
}

async function seedAircraftTypes() {
  console.log('🌱 Seeding AircraftType table from OpenFlights...');

  let planes: PlaneRecord[];
  try {
    planes = await fetchPlanes();
  } catch {
    // Fallback to local file
    const localPath = join(process.cwd(), 'prisma', 'planes.dat');
    console.log(`  📁 Fetch failed, reading local file: ${localPath}`);
    const text = readFileSync(localPath, 'utf-8');
    planes = [];
    for (const line of text.split('\n')) {
      const parsed = parseLine(line);
      if (parsed) planes.push(parsed);
    }
    if (planes.length === 0) {
      console.error('No planes found in local file.');
      process.exit(1);
    }
  }

  console.log(`  📦 Loaded ${planes.length} records from OpenFlights`);

  // Deduplicate by icao — OpenFlights sometimes has multiple IATA codes for one ICAO
  const byIcao = new Map<string, PlaneRecord>();
  for (const plane of planes) {
    if (plane.icao && !byIcao.has(plane.icao)) {
      byIcao.set(plane.icao, plane);
    }
  }

  console.log(`  📊 ${byIcao.size} unique ICAO codes`);

  let inserted = 0;
  let updated = 0;

  for (const [, plane] of byIcao) {
    const { vendor, model } = splitAircraftName(plane.name);

    const existing = await prisma.aircraftType.findUnique({
      where: { iataCode_icaoCode: { iataCode: '', icaoCode: plane.icao } },
    });

    if (existing) {
      await prisma.aircraftType.update({
        where: { iataCode_icaoCode: { iataCode: existing.iataCode ?? '', icaoCode: plane.icao } },
        data: {
          iataCode: plane.iata || existing.iataCode,
          vendor,
          model,
        },
      });
      updated++;
    } else {
      await prisma.aircraftType.create({
        data: {
          iataCode: plane.iata || null,
          icaoCode: plane.icao,
          vendor,
          model,
          engineType: null,
          engineCount: null,
          category: 'Landplane',
        },
      });
      inserted++;
    }
  }

  console.log(`  ✅ Inserted ${inserted} new aircraft types, updated ${updated} existing`);
  console.log('✅ AircraftType seed complete!');
}

seedAircraftTypes()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });