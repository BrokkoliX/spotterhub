/**
 * Vitest global setup — runs once before all test files.
 *
 * 1. Points DATABASE_URL at the isolated test database.
 * 2. Pushes the Prisma schema so tables exist (no migration history needed).
 * 3. The singleton PrismaClient in @spotterhub/db picks up the env var automatically.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://spotterhub:spotterhub_dev@localhost:5433/spotterhub_test';

export default function setup() {
  // Override for PrismaClient and all child processes
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  // Push schema to the test database (idempotent, no migration history)
  const schemaPath = path.resolve(__dirname, '../../packages/db/prisma/schema.prisma');
  execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
