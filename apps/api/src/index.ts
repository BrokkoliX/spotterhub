import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

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

  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: createContext,
  });

  console.log(`🚀 SpotterHub API ready at ${url}`);
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
