import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially — they share a database and clean tables in beforeEach
    fileParallelism: false,
    // Initialise the test database (separate from dev) before any tests run
    globalSetup: './vitest.setup.ts',
    // Override DATABASE_URL in the test worker process BEFORE any module imports PrismaClient
    setupFiles: ['./vitest.env.ts'],
  },
});
