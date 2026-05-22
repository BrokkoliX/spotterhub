/**
 * Backfill script: reconcile drifted `Photo.likeCount` values with actual
 * `Like` row counts.
 *
 * Background: prior to the Sprint 2 fix in `likeResolvers.ts`, `likePhoto`
 * and `unlikePhoto` performed three separate awaits (find/create/update),
 * which was vulnerable to a TOCTOU race that could leave the denormalised
 * `likeCount` drifted by ±1 on concurrent calls. Run this script once after
 * the transactional fix ships to restore consistency in production.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/backfill-like-counts.ts
 *   DATABASE_URL=postgres://... npx tsx scripts/backfill-like-counts.ts --dry-run
 *
 * The script is safe to re-run; it only updates rows whose stored count
 * disagrees with the live count of `Like` rows.
 */

import { prisma } from '@spotterspace/db';

interface DriftRow {
  id: string;
  storedCount: number;
  actualCount: number;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function findDriftedPhotos(): Promise<DriftRow[]> {
  const rows = await prisma.$queryRaw<{ id: string; stored: number; actual: bigint }[]>`
    SELECT
      p.id              AS id,
      p.like_count      AS stored,
      COUNT(l.id)       AS actual
    FROM photos p
    LEFT JOIN likes l ON l.photo_id = p.id
    GROUP BY p.id, p.like_count
    HAVING p.like_count <> COUNT(l.id)
  `;

  return rows.map((row) => ({
    id: row.id,
    storedCount: row.stored,
    actualCount: Number(row.actual),
  }));
}

async function main(): Promise<void> {
  const drifted = await findDriftedPhotos();

  if (drifted.length === 0) {
    console.log('No drifted likeCount values found. Nothing to do.');
    return;
  }

  console.log(`Found ${drifted.length} photo(s) with drifted likeCount:`);
  for (const row of drifted) {
    console.log(`  ${row.id}  stored=${row.storedCount}  actual=${row.actualCount}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — no updates applied.');
    return;
  }

  console.log('\nApplying corrections...');
  let fixed = 0;
  for (const row of drifted) {
    await prisma.photo.update({
      where: { id: row.id },
      data: { likeCount: row.actualCount },
    });
    fixed += 1;
  }
  console.log(`Updated ${fixed} photo(s).`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
