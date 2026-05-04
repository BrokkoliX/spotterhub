'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  ready: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  ready: false,
  toggleTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server and initial client render both start as dark + not ready.
  // This matches the inline script's fallback and prevents any VDOM diff
  // from becoming a hydration error on the children tree.
  const [state, setState] = useState<{ theme: Theme; ready: boolean }>({
    theme: 'dark',
    ready: false,
  });

  // Hydrate from localStorage after mount (client-only).
  // Mirrors AuthProvider's single-effect hydration pattern exactly.
  useEffect(() => {
    let theme: Theme = 'dark';
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        theme = stored;
      } else {
        theme = window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
      }
    } catch {
      // localStorage unavailable — stay dark
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after SSR requires setState in an effect
    setState({ theme, ready: true });
  }, []);

  // Sync theme to DOM and localStorage whenever it changes after hydration.
  // Skip the first render (ready: false) to avoid stomping the inline script.
  useEffect(() => {
    if (!state.ready) return;
    document.documentElement.setAttribute('data-theme', state.theme);
    try {
      localStorage.setItem('theme', state.theme);
    } catch {
      // ignore
    }
  }, [state.theme, state.ready]);

  const toggleTheme = useCallback(() => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    // Apply to DOM immediately to prevent visual flash — useEffect syncs on re-render
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.classList.add('theme-transitioning');
    setState({ theme: next, ready: true });
    // Remove class after the longest transition completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 300);
  }, [state.theme]);

  const value = useMemo(
    () => ({ theme: state.theme, ready: state.ready, toggleTheme }),
    [state, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
