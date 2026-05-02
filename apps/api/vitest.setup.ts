/**
 * Vitest global setup — runs once before all test files.
 *
 * 1. Validates TEST_DATABASE_URL is set (no fallback; see vitest.env.ts).
 * 2. Points DATABASE_URL at the isolated test database.
 * 3. Pushes the Prisma schema so tables exist (no migration history needed —
 *    `db push` is idempotent and reflects schema.prisma exactly, which is what
 *    tests need).
 * 4. The singleton PrismaClient in @spotterspace/db picks up the env var
 *    automatically.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  // Mirrors the check in vitest.env.ts so failures here give the same guidance
  // regardless of which setup step runs first.
  throw new Error(
    'TEST_DATABASE_URL is not set. Export it before running vitest.\n' +
      'Example (matches docker-compose):\n' +
      '  export TEST_DATABASE_URL=postgresql://spotterspace:spotterspace_dev@localhost:5433/spotterspace_test\n' +
      'See .env.example for details.',
  );
}

export default function setup() {
  // Override for PrismaClient and all child processes
  process.env.DATABASE_URL = testDatabaseUrl;

  // Push schema to the test database (idempotent, no migration history)
  const schemaPath = path.resolve(__dirname, '../../packages/db/prisma/schema.prisma');
  execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });
}
