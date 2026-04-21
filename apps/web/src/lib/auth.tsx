'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
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

/**
 * AuthProvider hydrates user from the HttpOnly cookie on mount
 * and exposes signIn/signOut methods that manage the cookie.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    user: User | null;
    token: string | null;
    ready: boolean;
  }>({ user: null, token: null, ready: false });

  // Hydrate user from cookie on mount (client-only).
  useEffect(() => {
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
  }, []);

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
