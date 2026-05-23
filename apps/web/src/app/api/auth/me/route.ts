import { NextRequest, NextResponse } from 'next/server';

import { graphqlEndpoint, internalOrigin } from '@/lib/internal-api';

// Prevent Next.js from caching this response so the client always gets fresh auth state
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ user: null });
  }

  // Cap upstream wait so a stalled API can't pin the user's browser tab open.
  // On timeout/error we return `user: null`; the UI treats this the same as
  // logged-out and the next API call will surface the real auth error if any.
  const ME_TIMEOUT_MS = 3000;

  try {
    const res = await fetch(graphqlEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // See @/lib/internal-api for why we set Origin on BFF→API calls.
        // The `me` query is read-only at the GraphQL level but rides over a
        // POST request, which the API's csrfGuard treats as a state-changing
        // request and gates on Origin / Sec-Fetch-Site.
        Origin: internalOrigin(request),
      },
      body: JSON.stringify({
        query: `
          query Me {
            me {
              id
              email
              username
              role
              sellerProfile {
                approved
              }
            }
          }
        `,
      }),
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });

    const data = await res.json();

    if (data.errors?.length) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: data.data.me });
  } catch {
    // Upstream timeout, network error, or malformed JSON. Surface as
    // unauthenticated so the UI can render; client retries on next route
    // change.
    return NextResponse.json({ user: null });
  }
}
