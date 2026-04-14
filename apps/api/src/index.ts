import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { createHash } from 'crypto';
import cors from 'cors';
import express from 'express';

import { createContext, type Context } from './context.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';
import { ensureBucket } from './services/s3.js';
import { prisma } from '@spotterspace/db';

const PORT = parseInt(process.env.API_PORT ?? '4000', 10);

/**
 * Fetch secrets from AWS Secrets Manager and set as environment variables.
 * Only runs in production when DATABASE_URL is not already set.
 * Uses the AWS SDK (credentials provided by App Runner instance role).
 */
async function loadSecrets(): Promise<void> {
  if (process.env.DATABASE_URL) return; // Already set (local dev or explicitly configured)

  console.log('Fetching secrets from AWS Secrets Manager...');

  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  );
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_REGION_NAME || 'us-east-1',
  });

  const [dbResult, jwtResult] = await Promise.all([
    client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/DATABASE_URL' })),
    client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/JWT_SECRET' })),
  ]);

  process.env.DATABASE_URL = dbResult.SecretString ?? '';
  process.env.JWT_SECRET = jwtResult.SecretString ?? '';
  console.log('Secrets loaded from Secrets Manager');
}

/**
 * Run Prisma migrations (idempotent — safe to run on every startup).
 * Only runs in production to auto-apply migrations on deploy.
 */
async function runMigrations(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  console.log('Running database migrations...');
  const { execSync } = await import('child_process');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Migrations applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

async function main() {
  // Load secrets before anything that reads env vars (DATABASE_URL, JWT_SECRET)
  await loadSecrets();

  // Run Prisma migrations after secrets are loaded (DATABASE_URL is now set)
  await runMigrations();

  // Ensure S3 bucket exists (creates it in LocalStack for dev)
  await ensureBucket();

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  const app = express();

  // Health check endpoint for App Runner
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Seed superuser endpoint (protected by JWT_SECRET header)
  app.post('/seed', async (req, res) => {
    const authHeader = req.headers['x-jwt-secret'];
    if (authHeader !== process.env.JWT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hash = createHash('sha256').update('Jerusalem!25').digest('hex');
    const sub = `dev1-${hash.slice(0, 32)}`;
    const user = await prisma.user.upsert({
      where: { email: 'robi_sz@yahoo.com' },
      update: { cognitoSub: sub, role: 'superuser' },
      create: {
        cognitoSub: sub,
        email: 'robi_sz@yahoo.com',
        username: 'robi_sz',
        role: 'superuser',
        status: 'active',
      },
    });
    res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  });

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: createContext,
    }),
  );

  app.listen({ port: PORT }, () => {
    console.log(`🚀 SpotterSpace API ready at http://localhost:${PORT}/graphql`);
  });
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
