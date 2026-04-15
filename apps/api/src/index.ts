import 'dotenv/config';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';

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
  // Only load from AWS if not already configured (local dev)
  if (process.env.DATABASE_URL && process.env.JWT_SECRET && process.env.RESEND_API_KEY) return;

  console.log('Fetching secrets from AWS Secrets Manager...');

  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  );
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_REGION_NAME || 'us-east-1',
  });

  const [dbResult, jwtResult, resendResult] = await Promise.all([
    client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/DATABASE_URL' })),
    client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/JWT_SECRET' })),
    client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/RESEND_API_KEY' })),
  ]);

  if (dbResult.SecretString) process.env.DATABASE_URL = dbResult.SecretString;
  if (jwtResult.SecretString) process.env.JWT_SECRET = jwtResult.SecretString;
  if (resendResult.SecretString) process.env.RESEND_API_KEY = resendResult.SecretString;
  console.log('Secrets loaded from Secrets Manager');
}

async function main() {
  // Load secrets before anything that reads env vars (DATABASE_URL, JWT_SECRET)
  await loadSecrets();

  // Fail hard if JWT_SECRET is missing or is the dev fallback in production
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'dev-secret-do-not-use-in-production') {
      console.error('FATAL: JWT_SECRET is not set or is the dev fallback. Refusing to start in production.');
      process.exit(1);
    }
  }

  // Ensure S3 bucket exists (creates it in LocalStack for dev)
  await ensureBucket();

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  const app = express();

  // ─── Rate Limiting ───────────────────────────────────────────────────────
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20, // 20 attempts per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
    // Only apply to auth-related GraphQL mutations
    skip: (req) => {
      const body = req.body as { query?: string } | undefined;
      if (!body?.query) return true;
      const query = body.query.toLowerCase();
      const authOps = ['signin', 'signup', 'resetpassword', 'requestpasswordreset', 'requestpasswordreminder', 'getuploadurl'];
      return !authOps.some((op) => query.includes(op));
    },
  });

  const seedRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many seed attempts, please try again later' },
  });

  // Health check endpoint for App Runner
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Seed superuser endpoint (protected by JWT_SECRET header).
  // Accepts { email, username, password } in the request body.
  app.post('/seed', seedRateLimiter, express.json(), async (req, res) => {
    const authHeader = req.headers['x-jwt-secret'];
    if (authHeader !== process.env.JWT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { email, username, password } = req.body ?? {};
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username, and password are required' });
    }
    const { default: bcrypt } = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);
    const { randomUUID } = await import('node:crypto');
    const sub = randomUUID();
    const user = await prisma.user.upsert({
      where: { email },
      update: { cognitoSub: sub, passwordHash, role: 'superuser' },
      create: {
        cognitoSub: sub,
        passwordHash,
        email,
        username,
        role: 'superuser',
        status: 'active',
        emailVerified: true,
      },
    });
    res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  });

  const allowedOrigins = [
    process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    // Allow www and non-www variants in production
    ...(process.env.WEB_BASE_URL ? [`https://www.${new URL(process.env.WEB_BASE_URL).hostname}`] : []),
  ];

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
      credentials: true,
    }),
    express.json(),
    authRateLimiter,
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
