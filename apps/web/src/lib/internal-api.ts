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
 *    `fetch` from the BFF sets neither. `internalOrigin()` derives the
 *    correct Origin to send by inspecting the incoming request's own
 *    `host` / `x-forwarded-host` / `x-forwarded-proto` headers — i.e. it
 *    sends back the same origin the user's browser used to reach the BFF.
 *    Since that origin is by definition on the API's allow-list (it's our
 *    own web tier), the BFF's outbound request passes the guard.
 *
 *    There is no genuine CSRF threat on these BFF→API calls — the BFF only
 *    forwards requests its own authenticated end users have already submitted
 *    with valid cookies — but the guard cannot distinguish server-to-server
 *    traffic without an explicit signal, so we provide one.
 */

import type { NextRequest } from 'next/server';

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
 *   1. The incoming request's own origin, derived from
 *      `x-forwarded-host` + `x-forwarded-proto` (set by the ALB / CloudFront)
 *      or `host` + assume `https`. This is the most reliable signal because
 *      the user's browser must have used an allowed origin to reach the BFF
 *      in the first place — so reflecting it back will always pass the API's
 *      origin allowlist.
 *   2. `WEB_BASE_URL` env var if no request is supplied (e.g. server-side
 *      bootstrap calls without a request context).
 *   3. `NEXT_PUBLIC_WEB_URL` env var.
 *   4. Localhost fallback for dev (`http://localhost:3000`).
 */
export function internalOrigin(request?: NextRequest | Request): string {
  if (request) {
    const headers = request.headers;
    const forwardedHost = headers.get('x-forwarded-host');
    const forwardedProto = headers.get('x-forwarded-proto');
    const host = forwardedHost ?? headers.get('host');
    if (host) {
      const proto = forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  }
  return process.env.WEB_BASE_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? DEFAULT_INTERNAL_ORIGIN;
}
