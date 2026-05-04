import type { ServerResponse } from 'node:http';

import type { StandaloneServerContextFunctionArgument } from '@apollo/server/standalone';
import { prisma } from '@spotterspace/db';
import jwt from 'jsonwebtoken';

import { createLoaders, type Loaders } from './loaders.js';

export interface AuthUser {
  sub: string;
  email: string;
  username: string;
}

export interface Context {
  prisma: typeof prisma;
  user: AuthUser | null;
  loaders: Loaders;
  res: ServerResponse;
  req: StandaloneServerContextFunctionArgument['req'];
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Creates the Apollo Server context for each request.
 * Extracts and verifies the JWT from the Authorization header OR from
 * an access_token HttpOnly cookie (set by signIn).
 * In development, uses a simple JWT; in production, this will be replaced
 * with AWS Cognito token verification.
 */
export async function createContext({
  req,
  res,
}: StandaloneServerContextFunctionArgument): Promise<Context> {
  let user: AuthUser | null = null;

  // Try Authorization header first, then fall back to cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req as { cookies?: { access_token?: string } }).cookies?.access_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as AuthUser;
      user = {
        sub: decoded.sub,
        email: decoded.email,
        username: decoded.username,
      };
    } catch {
      // Invalid token — treat as unauthenticated
    }
  }

  return { prisma, user, loaders: createLoaders(prisma), res, req };
}
