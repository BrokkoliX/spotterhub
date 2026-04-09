'use client';

import { useMemo } from 'react';
import { Provider as UrqlProvider } from 'urql';

import { AuthProvider } from './auth';
import { makeClient } from './graphql';

/**
 * Wraps the app with all required client-side providers:
 * - urql GraphQL client
 * - Auth context (JWT + user state)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => makeClient(), []);

  return (
    <UrqlProvider value={client}>
      <AuthProvider>{children}</AuthProvider>
    </UrqlProvider>
  );
}
