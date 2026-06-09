import 'server-only';

import { headers } from 'next/headers';

import { fixLocalhostUrl } from '@/lib/image-url';
import { graphqlEndpoint } from '@/lib/internal-api';

// Re-export for layouts that import helpers and fetchers from one place.
export { fixLocalhostUrl };

// Centralized env-derived constants for Open Graph / Twitter Card metadata.
// Server-only: the API fetch is server-side and we don't want to leak this
// module into client bundles.

const DEFAULT_WEB_BASE = 'http://localhost:3000';

/**
 * Public base URL of the web app. Used to build absolute canonical URLs in
 * metadata (og:url, canonical, default OG image fallback).
 *
 * Resolution order:
 *   1. `WEB_BASE_URL` env var (set in CDK source but not in the live task def
 *      due to a known deploy-pipeline split-brain, so usually absent in prod)
 *   2. `NEXT_PUBLIC_WEB_URL` env var (client-safe, set in dev)
 *   3. Derived from the incoming request's host headers — works in production
 *      because the web task sits behind an ALB/CloudFront that sets
 *      `x-forwarded-host` to the real domain
 *   4. Localhost fallback for dev
 */
export async function getWebBase(): Promise<string> {
  if (process.env.WEB_BASE_URL) return process.env.WEB_BASE_URL;
  if (process.env.NEXT_PUBLIC_WEB_URL) return process.env.NEXT_PUBLIC_WEB_URL;
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable in this context (shouldn't happen in route handlers)
  }
  return DEFAULT_WEB_BASE;
}

/**
 * Sync version for code paths that already have a known web base (e.g. the
 * share buttons on the client, which use NEXT_PUBLIC_WEB_URL). Falls back to
 * localhost in dev or when env vars are missing — the same limitation the
 * previous code had.
 */
export const WEB_BASE =
  process.env.WEB_BASE_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? DEFAULT_WEB_BASE;

/**
 * Build the Origin header for BFF→API fetches. Mirrors internalOrigin() from
 * lib/internal-api but inlined here so we don't need a Request object. The
 * API's csrfGuard requires an Origin that matches an allow-listed origin;
 * reflecting the user's own origin back is the only safe value for a
 * server-to-server call.
 */
async function getOriginHeader(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  } catch {
    // fall through
  }
  return process.env.WEB_BASE_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? DEFAULT_WEB_BASE;
}

async function gqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(graphqlEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: await getOriginHeader(),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error(
        `[og] GraphQL non-2xx: ${res.status} ${res.statusText} url=${graphqlEndpoint()} vars=${JSON.stringify(variables)}`,
      );
      return null;
    }
    const json = await res.json();
    if (json.errors) {
      console.error(
        `[og] GraphQL errors: ${JSON.stringify(json.errors)} vars=${JSON.stringify(variables)}`,
      );
      return null;
    }
    return json.data ?? null;
  } catch (err) {
    console.error(
      `[og] GraphQL fetch threw: ${err instanceof Error ? err.message : String(err)} url=${graphqlEndpoint()}`,
    );
    return null;
  }
}

export interface PhotoForOG {
  caption: string | null;
  takenAt: string | null;
  photographerName: string | null;
  variants: Array<{ variantType: string; url: string; width: number; height: number }>;
  user: { username: string; profile: { displayName: string | null } } | null;
  aircraft: { registration: string | null } | null;
  airline: string | null;
}

export interface CommunityForOG {
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  memberCount: number;
}

export interface UserForOG {
  username: string;
  profile: { displayName: string | null; bio: string | null } | null;
}

export async function fetchPhotoForOG(id: string) {
  return gqlFetch<{ photo: PhotoForOG | null }>(
    `query PhotoForOG($id: ID!) {
      photo(id: $id) {
        caption
        takenAt
        photographerName
        variants { variantType url width height }
        user { username profile { displayName } }
        aircraft { registration }
        airline
      }
    }`,
    { id },
  );
}

export async function fetchCommunityForOG(slug: string) {
  return gqlFetch<{ community: CommunityForOG | null }>(
    `query CommunityForOG($slug: String!) {
      community(slug: $slug) {
        name
        slug
        description
        bannerUrl
        memberCount
      }
    }`,
    { slug },
  );
}

export async function fetchUserForOG(username: string) {
  return gqlFetch<{ user: UserForOG | null }>(
    `query UserForOG($username: String!) {
      user(username: $username) {
        username
        profile { displayName bio }
      }
    }`,
    { username },
  );
}
