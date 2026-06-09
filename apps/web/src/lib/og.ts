import 'server-only';

import { fixLocalhostUrl, WEB_BASE } from '@/lib/image-url';

// Re-export for layouts that import both helpers and fetchers from one place.
export { fixLocalhostUrl, WEB_BASE };

// Centralized env-derived constants for Open Graph / Twitter Card metadata.
// Server-only: the API fetch is server-side and we don't want to leak this
// module into client bundles.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function gqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
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
