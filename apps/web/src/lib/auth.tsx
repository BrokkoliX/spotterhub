'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createContext, useContext } from 'react';
import { Provider as UrqlProvider } from 'urql';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  sellerProfile?: { approved: boolean } | null;
}

interface AuthContextValue {
  /** The currently authenticated user, or null if signed out. */
  user: User | null;
  /** JWT access token — always null for browser clients (stored in HttpOnly cookie). */
  token: string | null;
  /** Whether the initial auth check has completed. */
  ready: boolean;
  /** Sign in via the API route (sets HttpOnly cookie). */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign out: clears the HttpOnly cookie. */
  signOut: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

/** Hook to access auth state. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────

type AuthProviderProps = {
  children: React.ReactNode;
  serverAuth?: {
    user: { id: string; email: string; username: string; role: string; sellerProfile?: { approved: boolean } | null } | null;
  };
};

/**
 * AuthProvider hydrates user from the server-rendered auth state on first render
 * (avoiding hydration flash), then falls back to a client-side /api/auth/me fetch
 * to refresh the state on mount.
 */
export function AuthProvider({ children, serverAuth }: AuthProviderProps) {
  const [state, setState] = useState<{
    user: User | null;
    token: string | null;
    ready: boolean;
  }>({
    // Initialize from server-rendered auth state to avoid hydration flash
    user: serverAuth?.user ?? null,
    token: null,
    ready: !!serverAuth,
  });

  // On mount, refresh from the API to pick up any server-side changes
  // (the serverAuth prop covers the initial render)
  useEffect(() => {
    // If we already have server auth, revalidate in the background but don't block ready
    if (serverAuth?.user) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setState((prev) =>
              prev.user?.id === data.user.id ? prev : { user: data.user, token: null, ready: true },
            );
          }
        })
        .catch(() => {
          // Ignore network errors — server auth is already set
        });
      return;
    }

    // No server auth — do a full client-side hydration
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setState({ user: data.user, token: null, ready: true });
        } else {
          setState({ user: null, token: null, ready: true });
        }
      })
      .catch(() => {
        setState({ user: null, token: null, ready: true });
      });
  }, [serverAuth]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error ?? 'Sign in failed');
    }
    setState({ user: data.user, token: null, ready: true });
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setState({ user: null, token: null, ready: true });
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      token: state.token,
      ready: state.ready,
      signIn,
      signOut,
    }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}