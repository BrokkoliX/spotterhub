import type { StandaloneServerContextFunctionArgument } from '@apollo/server/standalone';
import { prisma } from '@spotterhub/db';
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
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';

/**
 * Creates the Apollo Server context for each request.
 * Extracts and verifies the JWT from the Authorization header.
 * In development, uses a simple JWT; in production, this will be replaced
 * with AWS Cognito token verification.
 */
export async function createContext({
  req,
}: StandaloneServerContextFunctionArgument): Promise<Context> {
  let user: AuthUser | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      user = {
        sub: decoded.sub,
        email: decoded.email,
        username: decoded.username,
      };
    } catch {
      // Invalid token — treat as unauthenticated
    }
  }

  return { prisma, user, loaders: createLoaders(prisma) };
}
