import 'dotenv/config';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { prisma } from '@spotterspace/db';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import { createContext, type Context } from './context.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';
import { ensureBucket } from './services/s3.js';

const PORT = parseInt(process.env.API_PORT ?? '4000', 10);

/**
 * Fetch secrets from AWS Secrets Manager and set as environment variables.
 * Only runs in production when DATABASE_URL is not already set.
 * Uses the AWS SDK (credentials provided by App Runner instance role).
 */
async function loadSecrets(): Promise<void> {
  // Skip entirely in local dev when all secrets are configured
  if (process.env.DATABASE_URL && process.env.JWT_SECRET && process.env.RESEND_API_KEY) return;

  console.log('Fetching secrets from AWS Secrets Manager...');

  const { SecretsManagerClient, GetSecretValueCommand } =
    await import('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_REGION_NAME || 'us-east-1',
  });

  // DATABASE_URL and JWT_SECRET may already be injected by ECS task definition
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    const [dbResult, jwtResult] = await Promise.all([
      client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/DATABASE_URL' })),
      client.send(new GetSecretValueCommand({ SecretId: 'spotterhub/JWT_SECRET' })),
    ]);
    if (dbResult.SecretString) process.env.DATABASE_URL = dbResult.SecretString;
    if (jwtResult.SecretString) process.env.JWT_SECRET = jwtResult.SecretString;
  }

  // RESEND_API_KEY is not in the ECS task definition — always fetch if missing
  if (!process.env.RESEND_API_KEY) {
    try {
      const resendResult = await client.send(
        new GetSecretValueCommand({ SecretId: 'spotterhub/RESEND_API_KEY' }),
      );
      if (resendResult.SecretString) process.env.RESEND_API_KEY = resendResult.SecretString;
    } catch (err) {
      console.warn(
        'Could not load RESEND_API_KEY — email features disabled:',
        (err as Error).message,
      );
    }
  }

  console.log('Secrets loaded from Secrets Manager');
}

async function main() {
  // Load secrets before anything that reads env vars (DATABASE_URL, JWT_SECRET)
  await loadSecrets();

  // Fail hard if JWT_SECRET is missing or is the dev fallback in production
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'dev-secret-do-not-use-in-production') {
      console.error(
        'FATAL: JWT_SECRET is not set or is the dev fallback. Refusing to start in production.',
      );
      process.exit(1);
    }
  }

  // Ensure S3 bucket exists (creates it in LocalStack for dev)
  await ensureBucket();

  const server = new ApolloServer<Context>({
    schema: makeExecutableSchema({
      typeDefs,
      resolvers,
      resolverValidationOptions: { requireResolversToMatchSchema: 'ignore' },
    }),
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  const app = express();

  // Trust the ALB/reverse proxy so express-rate-limit uses X-Forwarded-For correctly
  app.set('trust proxy', 1);

  // Parse cookies for auth context
  app.use(cookieParser());

  // ─── Rate Limiting ───────────────────────────────────────────────────────
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5000, // 5000 requests per window (upsert-heavy admin imports)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    // Only apply to auth-related GraphQL mutations
    skip: (req) => {
      const body = req.body as { query?: string } | undefined;
      if (!body?.query) return true;
      const query = body.query.toLowerCase();
      const authOps = [
        'signin',
        'signup',
        'resetpassword',
        'requestpasswordreset',
        'requestpasswordreminder',
        'getuploadurl',
      ];
      return !authOps.some((op) => query.includes(op));
    },
  });

  // Per-email rate limit for password reset requests: max 3 per hour per email
  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour per email
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many password reset requests for this email. Please try again later.' },
    // Only apply this limiter to requestPasswordReset mutations
    skip: (req) => {
      const body = req.body as { query?: string } | undefined;
      if (!body?.query) return true;
      return !body.query.toLowerCase().includes('requestpasswordreset');
    },
    keyGenerator: (req) => {
      const body = req.body as { variables?: { email?: string } } | undefined;
      const email = body?.variables?.email?.toLowerCase();
      return email ? `email:${email}` : `ip:${req.ip}`;
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
      update: { cognitoSub: sub, passwordHash, role: 'superuser', emailVerified: true },
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

  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  // Admin endpoint to manually verify a user's email (protected by JWT_SECRET header).
  app.post('/admin/verify-email', adminRateLimiter, express.json(), async (req, res) => {
    const authHeader = req.headers['x-jwt-secret'];
    if (authHeader !== process.env.JWT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true, emailVerificationToken: null },
    });
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
    });
  });

  const allowedOrigins = [
    process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    // Allow www and non-www variants in production
    ...(process.env.WEB_BASE_URL
      ? [`https://www.${new URL(process.env.WEB_BASE_URL).hostname}`]
      : []),
  ];

  // ─── CSRF Guard ───────────────────────────────────────────────────────────
  // Verifies Origin header on state-changing requests to prevent cross-site attacks.
  // Browsers automatically omit Origin on same-site requests; custom header required for mutations.
  const csrfGuard = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only protect mutations — GET queries are read-only
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      return next();
    }
    const origin = req.headers.origin;
    if (!origin) {
      // No Origin header — same-site request (browser omits it automatically)
      return next();
    }
    // Validate origin matches one of our allowed domains
    if (!allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Invalid origin' });
      return;
    }
    next();
  };

  // ─── GraphQL Rate Limiting ─────────────────────────────────────────────
  // General rate limiter for all GraphQL operations (prevents abuse/cost attacks)
  const graphqlLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many GraphQL requests, please try again later' },
    keyGenerator: (req) => {
      // Use authenticated user sub for per-user rate limiting when available
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(
            authHeader.slice(7),
            process.env.JWT_SECRET!,
          ) as { sub: string };
          return `user:${decoded.sub}`;
        } catch {
          // fall through to IP-based
        }
      }
      // Fall back to IP for unauthenticated requests
      return `ip:${req.ip}`;
    },
  });

  app.use(
    '/graphql',
    // Order matters: parse body FIRST so rate limiters can read req.body.query
    express.json(),
    csrfGuard,
    graphqlLimiter,
    passwordResetLimiter,
    cors<cors.CorsRequest>({
      origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
      credentials: true,
    }),
    authRateLimiter,
    expressMiddleware(server, {
      context: createContext,
    }),
  );

  // Stripe webhook endpoint
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;
    try {
      const { constructWebhookEvent } = await import('./services/stripe.js');
      event = constructWebhookEvent(req.body, signature, webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'completed',
              stripePaymentIntentId: session.payment_intent as string | null,
            },
          });
          // Mark photo listing as inactive (sold)
          const order = await prisma.order.findUnique({ where: { id: orderId } });
          if (order) {
            await prisma.photoListing.update({
              where: { id: order.listingId },
              data: { active: false },
            });
            await prisma.photo.update({
              where: { id: order.photoId },
              data: { hasActiveListing: false },
            });
          }
        }
      } else if (event.type === 'checkout.session.expired') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'failed' },
          });
        }
      }
    } catch (err) {
      console.error('Error processing webhook event:', err);
    }

    res.json({ received: true });
  });

  app.listen({ port: PORT }, () => {
    console.log(`🚀 SpotterSpace API ready at http://localhost:${PORT}/graphql`);
  });
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
