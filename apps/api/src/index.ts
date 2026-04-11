import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express';

import { createContext, type Context } from './context.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';
import { ensureBucket } from './services/s3.js';

const PORT = parseInt(process.env.API_PORT ?? '4000', 10);

async function main() {
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

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: createContext,
    }),
  );

  app.listen({ port: PORT }, () => {
    console.log(`🚀 SpotterHub API ready at http://localhost:${PORT}/graphql`);
  });
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
