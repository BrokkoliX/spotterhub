/**
 * Vitest setup file — runs in the same process as each test file.
 *
 * Overrides DATABASE_URL so the PrismaClient singleton from @spotterspace/db
 * connects to the isolated test database instead of the dev database.
 *
 * This MUST run before any module imports PrismaClient, which is why
 * it's listed in `setupFiles` (not `globalSetup`).
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://spotterhub:spotterhub_dev@localhost:5433/spotterhub';

process.env.DATABASE_URL = TEST_DATABASE_URL;
