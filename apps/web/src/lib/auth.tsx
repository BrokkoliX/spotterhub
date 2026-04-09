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

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
}

interface AuthContextValue {
  /** The currently authenticated user, or null if signed out. */
  user: User | null;
  /** JWT access token, or null. */
  token: string | null;
  /** Whether the initial auth check has completed. */
  ready: boolean;
  /** Sign in: stores token + user and triggers re-render. */
  signIn: (token: string, user: User) => void;
  /** Sign out: clears stored auth state. */
  signOut: () => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  ready: false,
  signIn: () => {},
  signOut: () => {},
});

/** Hook to access auth state. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────

/**
 * AuthProvider reads persisted auth from localStorage on mount
 * and exposes signIn/signOut methods to the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    user: User | null;
    token: string | null;
    ready: boolean;
  }>({ user: null, token: null, ready: false });

  // Hydrate auth from localStorage after mount (client-only).
  // This ensures server and client initial renders both have user=null,
  // preventing hydration mismatches. A single setState call avoids
  // cascading renders.
  useEffect(() => {
    let user: User | null = null;
    let token: string | null = null;
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        token = storedToken;
        user = JSON.parse(storedUser) as User;
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after SSR requires setState in an effect
    setState({ user, token, ready: true });
  }, []);

  const signIn = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setState({ user: newUser, token: newToken, ready: true });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
