'use client';

import { cacheExchange, createClient, fetchExchange } from 'urql';

const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000')
    : '/api/graphql';

/**
 * Creates a urql GraphQL client.
 * In the browser, requests go through the Next.js rewrite proxy to avoid CORS.
 * During SSR, requests go directly to the API.
 */
export function makeClient() {
  return createClient({
    url: API_URL,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      return {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };
    },
  });
}
