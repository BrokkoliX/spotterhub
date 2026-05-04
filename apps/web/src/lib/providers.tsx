'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Provider as UrqlProvider } from 'urql';

import { AuthProvider } from './auth';
import { makeClient } from './graphql';
import { ThemeProvider } from './theme';

// ─── Server Auth State ───────────────────────────────────────────────────────
// Passed from the root layout (server component) to the client Providers.
// Allows the initial render to already have auth state — no hydration flash.
export interface ServerAuthState {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    sellerProfile?: { approved: boolean } | null;
  } | null;
}

const ServerAuthContext = createContext<ServerAuthState>({ user: null });

export function useServerAuth(): ServerAuthState {
  return useContext(ServerAuthContext);
}

// ─── Providers ───────────────────────────────────────────────────────────────

export function Providers({
  children,
  serverAuth,
}: {
  children: React.ReactNode;
  serverAuth?: ServerAuthState;
}) {
  const client = useMemo(() => makeClient(), []);

  return (
    <ServerAuthContext.Provider value={serverAuth ?? { user: null }}>
      <ThemeProvider>
        <UrqlProvider value={client}>
          <AuthProvider serverAuth={serverAuth}>{children}</AuthProvider>
        </UrqlProvider>
      </ThemeProvider>
    </ServerAuthContext.Provider>
  );
}