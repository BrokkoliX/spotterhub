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
 * - Reading the JWT from localStorage and attaching it to requests
 * - Detecting UNAUTHENTICATED errors and clearing stale tokens
 * - Redirecting to sign-in when the token has expired
 *
 * In the browser, requests go through the Next.js rewrite proxy to avoid CORS.
 * During SSR, requests go directly to the API.
 */
export function makeClient() {
  return createClient({
    url: API_URL,
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => ({
        addAuthToOperation(operation) {
          const token =
            typeof window !== 'undefined'
              ? localStorage.getItem('token')
              : null;
          if (!token) return operation;
          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${token}`,
          });
        },

        didAuthError(error) {
          return error.graphQLErrors.some(
            (e) => e.extensions?.code === 'UNAUTHENTICATED',
          );
        },

        async refreshAuth() {
          // No refresh token flow yet — clear stale token and redirect to sign-in
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/sign-in';
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
