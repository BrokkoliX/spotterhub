'use client';

import { authExchange } from '@urql/exchange-auth';
import { cacheExchange, createClient, fetchExchange, mapExchange } from 'urql';

const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000')
    : '/api/graphql';

/**
 * Creates a urql GraphQL client with auth exchange.
 *
 * The auth exchange handles:
 * - Cookie-based auth: HttpOnly cookies are automatically sent with same-origin requests
 * - Detecting UNAUTHENTICATED errors and redirecting to sign-in
 *
 * In the browser, requests go through the Next.js rewrite proxy to avoid CORS.
 * During SSR, requests go directly to the API.
 */
export function makeClient() {
  return createClient({
    url: API_URL,
    fetchOptions: {
      credentials: 'include', // Send cookies with same-origin requests
    },
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => ({
        addAuthToOperation(operation) {
          // Token is stored in HttpOnly cookie — browser sends it automatically.
          // For programmatic access (SSR, etc.), also check a non-HttpOnly fallback.
          if (typeof window !== 'undefined') {
            // Browser: cookie is sent automatically via credentials: 'include'
            return operation;
          }
          return operation;
        },

        didAuthError(error) {
          return error.graphQLErrors.some(
            (e) => e.extensions?.code === 'UNAUTHENTICATED',
          );
        },

        async refreshAuth() {
          // Redirect to sign-in on auth errors — cookie may have expired.
          if (typeof window !== 'undefined') {
            window.location.href = '/signin';
          }
        },
      })),
      // Ensure Content-Type header is always set (required by Apollo CSRF protection)
      mapExchange({
        onOperation(operation) {
          return {
            ...operation,
            context: {
              ...operation.context,
              fetchOptions: {
                ...(typeof operation.context.fetchOptions === 'function'
                  ? operation.context.fetchOptions()
                  : operation.context.fetchOptions),
                credentials: 'include',
                headers: {
                  ...(typeof operation.context.fetchOptions === 'function'
                    ? operation.context.fetchOptions()
                    : operation.context.fetchOptions
                  )?.headers,
                  'Content-Type': 'application/json',
                },
              },
            },
          };
        },
      }),
      fetchExchange,
    ],
  });
}
