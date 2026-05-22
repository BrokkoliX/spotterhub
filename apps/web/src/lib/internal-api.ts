/**
 * Helpers for server-to-server calls from the Next.js BFF (API routes,
 * server components, layout) to the GraphQL API.
 *
 * Two concerns this module owns:
 *
 * 1. **Endpoint URL normalisation.** `NEXT_PUBLIC_API_URL` has historically
 *    been set inconsistently across environments — sometimes as a base host
 *    (e.g. `http://localhost:4000`), sometimes including the GraphQL path
 *    (e.g. `https://api.spotterspace.com/graphql`). `graphqlEndpoint()`
 *    accepts either form and returns a fully-qualified `/graphql` URL.
 *
 * 2. **CSRF guard satisfaction.** The API's `csrfGuard` (`apps/api/src/index.ts`)
 *    rejects state-changing requests (`POST`, `PATCH`, `DELETE`) that lack both
 *    an `Origin` header that matches an allow-listed origin **and** a
 *    `Sec-Fetch-Site` header. Browser fetches set both automatically; Node
 *    `fetch` from the BFF sets neither. `internalOrigin()` returns the
 *    web tier's own base URL, which the API has on its allow-list, so the
 *    BFF can satisfy the guard without any code changes on the API side.
 *
 *    There is no genuine CSRF threat on these BFF→API calls — the BFF only
 *    forwards requests its own authenticated end users have already submitted
 *    with valid cookies — but the guard cannot distinguish server-to-server
 *    traffic without an explicit signal, so we provide one.
 */

const DEFAULT_API_BASE = 'http://localhost:4000';
const DEFAULT_INTERNAL_ORIGIN = 'http://localhost:3000';

/**
 * Returns the GraphQL endpoint URL, e.g. `https://api.spotterspace.com/graphql`.
 *
 * Accepts `NEXT_PUBLIC_API_URL` in either of the two historical shapes:
 *   - base host:        `https://api.spotterspace.com`
 *   - includes path:    `https://api.spotterspace.com/graphql`
 *
 * Always returns a URL ending in exactly one `/graphql` path segment.
 */
export function graphqlEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE;
  // Trim any trailing slash, then strip a single trailing /graphql if present.
  const base = raw.replace(/\/+$/, '').replace(/\/graphql$/, '');
  return `${base}/graphql`;
}

/**
 * Returns the Origin header value to use on BFF→API fetches.
 *
 * Resolution order:
 *   1. `WEB_BASE_URL` env var (set by the CDK stack on the web container).
 *   2. `NEXT_PUBLIC_WEB_URL` env var (Next.js convention if present).
 *   3. Localhost fallback for dev (`http://localhost:3000`).
 */
export function internalOrigin(): string {
  return process.env.WEB_BASE_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? DEFAULT_INTERNAL_ORIGIN;
}
