'use client';

import { GoogleAnalytics } from 'nextjs-google-analytics';

/**
 * Client-only wrapper around `nextjs-google-analytics`.
 *
 * The upstream package (v2.3.7) does not ship a `"use client"` directive on
 * its components, so when it's imported directly into a Server Component
 * (e.g. App Router's `layout.tsx`) React tries to call `useEffect` during
 * SSR and throws `TypeError: (0, d.useEffect) is not a function`, which
 * crashes the entire route tree.
 *
 * Keeping this wrapper means the layout stays a Server Component while the
 * analytics tracker initialises only on the client, after hydration.
 */
export function Analytics() {
  return <GoogleAnalytics trackPageViews />;
}
