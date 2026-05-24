/**
 * One-off backfill: regenerate `display` (and other) image variants for all
 * existing photos at the new larger size.
 *
 * Background: the `display` variant was previously generated at 640px on the
 * long edge, which users reported as "the platform resizing my photos." The
 * size has been bumped to 2048px (see `IMAGE_VARIANT_SIZES.display` in
 * `@spotterspace/shared`). This script reprocesses every existing photo so
 * the change is reflected for already-uploaded content, not just future
 * uploads.
 *
 * How it runs in production
 * -------------------------
 * This module is compiled into `apps/api/dist/scripts/backfillDisplayVariants.js`
 * and shipped inside the API runtime image. It is invoked exclusively via a
 * one-off ECS task that sets `RUN_BACKFILL_DISPLAY_VARIANTS=true`, which the
 * container entrypoint dispatches to. The same image, secrets, network
 * config, and IAM role used by the live API service are reused — so the
 * script reaches RDS and S3 the same way the API does.
 *
 * CLI flags
 * ---------
 *   --dry-run         List what would be regenerated without uploading or
 *                     touching the DB. Safe to run as a smoke test.
 *   --limit N         Process at most N photos (oldest-first). Useful for
 *                     a small canary before a full run.
 *   --concurrency N   How many photos to process in parallel (default 4).
 *                     Sharp is CPU-bound on the libuv thread pool, so don't
 *                     go higher than ~2× the task's vCPU count.
 *
 * Idempotency & failure handling
 * ------------------------------
 * For each photo:
 *   1. Derive the S3 key from `Photo.originalUrl` (mirrors
 *      `regeneratePhotoVariants` in `photoResolvers.ts`).
 *   2. Call `generateVariants` — same code path as the upload mutation.
 *   3. In a single Prisma transaction: delete existing `PhotoVariant` rows
 *      and insert the freshly generated ones. The atomic swap ensures no
 *      photo can ever be observed with zero variants by the API.
 *
 * Per-photo failures (e.g. the original is missing from S3) are logged and
 * the run continues. A non-zero exit code is set if any photo failed, so
 * the ECS task surfaces the failure to the operator.
 */

import { prisma } from '@spotterspace/db';

import { generateVariants } from '../services/imageProcessing.js';

interface CliOptions {
  dryRun: boolean;
  limit: number | null;
  concurrency: number;
}

function parseArgs(argv: string[]): CliOptions {
  const dryRun = argv.includes('--dry-run');
  const limitIdx = argv.indexOf('--limit');
  const concurrencyIdx = argv.indexOf('--concurrency');
  const limit =
    limitIdx >= 0 && argv[limitIdx + 1] ? Number.parseInt(argv[limitIdx + 1], 10) : null;
  const concurrency =
    concurrencyIdx >= 0 && argv[concurrencyIdx + 1]
      ? Number.parseInt(argv[concurrencyIdx + 1], 10)
      : 4;

  if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`Invalid --limit value: ${argv[limitIdx + 1]}`);
  }
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error(`Invalid --concurrency value: ${argv[concurrencyIdx + 1]}`);
  }

  return { dryRun, limit, concurrency };
}

/**
 * Convert a photo's `originalUrl` (a fully-qualified S3 / CloudFront URL)
 * back to the S3 object key. Mirrors the derivation used by the
 * `regeneratePhotoVariants` resolver in `photoResolvers.ts`.
 */
export function s3KeyFromOriginalUrl(originalUrl: string): string {
  const url = new URL(originalUrl);
  return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
}

interface PhotoJob {
  id: string;
  originalUrl: string;
  watermarkEnabled: boolean;
}

interface FailedJob {
  id: string;
  reason: string;
}

async function processPhoto(photo: PhotoJob, dryRun: boolean): Promise<void> {
  const s3Key = s3KeyFromOriginalUrl(photo.originalUrl);

  if (dryRun) {
    console.log(`  [dry-run] would regenerate variants for ${photo.id} from ${s3Key}`);
    return;
  }

  const variants = await generateVariants(s3Key, {
    watermarkEnabled: photo.watermarkEnabled,
  });

  // Atomic swap: drop the old rows and insert the new ones in one transaction
  // so a failure mid-write can never leave a photo with zero variants visible
  // to the API.
  await prisma.$transaction([
    prisma.photoVariant.deleteMany({ where: { photoId: photo.id } }),
    prisma.photoVariant.createMany({
      data: variants.map((variant) => ({
        photoId: photo.id,
        variantType: variant.variantType,
        url: variant.url,
        width: variant.width,
        height: variant.height,
        fileSizeBytes: variant.fileSizeBytes,
      })),
    }),
  ]);

  console.log(`  ✓ ${photo.id}  (${variants.length} variants)`);
}

/**
 * Run `worker` over every job with at most `concurrency` in flight.
 * A simple worker-pool pattern; avoids pulling in `p-limit` for one script.
 */
async function runWithConcurrency(
  jobs: PhotoJob[],
  concurrency: number,
  worker: (job: PhotoJob) => Promise<void>,
): Promise<{ successes: number; failures: FailedJob[] }> {
  const failures: FailedJob[] = [];
  let successes = 0;
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < jobs.length) {
      const idx = cursor;
      cursor += 1;
      const job = jobs[idx];
      try {
        await worker(job);
        successes += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ id: job.id, reason });
        console.error(`  ✗ ${job.id}  ${reason}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => next());
  await Promise.all(workers);
  return { successes, failures };
}

/**
 * Bootstrap — load AWS Secrets Manager-backed env vars (DATABASE_URL etc.)
 * the same way the API server does, so this script works inside an ECS task
 * that doesn't have those vars injected directly. Imported lazily so unit
 * tests can exercise pure helpers without pulling in AWS SDK clients.
 */
async function loadProductionSecrets(): Promise<void> {
  // If DATABASE_URL is already present (local dev, tests), skip the AWS hop.
  if (process.env.DATABASE_URL) return;

  const { SecretsManagerClient, GetSecretValueCommand } =
    await import('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_REGION_NAME || 'us-east-1',
  });

  const dbResult = await client.send(
    new GetSecretValueCommand({ SecretId: 'spotterhub/DATABASE_URL' }),
  );
  if (dbResult.SecretString) {
    // The secret is stored as raw JSON `{"DATABASE_URL":"postgres://..."}` in
    // some envs and as a bare connection string in others. Handle both.
    try {
      const parsed = JSON.parse(dbResult.SecretString) as { DATABASE_URL?: string };
      process.env.DATABASE_URL = parsed.DATABASE_URL ?? dbResult.SecretString;
    } catch {
      process.env.DATABASE_URL = dbResult.SecretString;
    }
  }
}

async function main(): Promise<void> {
  await loadProductionSecrets();

  const opts = parseArgs(process.argv.slice(2));

  console.log('Backfilling display variants with options:', opts);

  const photos = await prisma.photo.findMany({
    select: { id: true, originalUrl: true, watermarkEnabled: true },
    orderBy: { createdAt: 'asc' },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  if (photos.length === 0) {
    console.log('No photos found. Nothing to do.');
    return;
  }

  console.log(`Processing ${photos.length} photo(s)...\n`);
  const { successes, failures } = await runWithConcurrency(photos, opts.concurrency, (photo) =>
    processPhoto(photo, opts.dryRun),
  );

  console.log(`\nDone. ${successes} succeeded, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.log('\nFailed photos (re-run to retry):');
    for (const f of failures) {
      console.log(`  ${f.id}  ${f.reason}`);
    }
    process.exitCode = 1;
  }
}

// Only run when explicitly enabled via env var. This mirrors the
// `RUN_MIGRATIONS=true` convention in `docker-entrypoint.sh` and lets unit
// tests import the pure helpers (e.g. `s3KeyFromOriginalUrl`) from this
// module without triggering the backfill as a side-effect.
if (process.env.RUN_BACKFILL_DISPLAY_VARIANTS === 'true') {
  main()
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
