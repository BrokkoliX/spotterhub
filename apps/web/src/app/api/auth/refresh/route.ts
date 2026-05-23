import { NextRequest, NextResponse } from 'next/server';

import { graphqlEndpoint, internalOrigin } from '@/lib/internal-api';

// Fallbacks if the API ever omits the new cookie-lifetime fields. Match the
// values that were hardcoded prior to making session timeouts configurable.
const FALLBACK_ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour
const FALLBACK_REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * POST /api/auth/refresh
 * Exchanges the current refresh_token cookie for a new short-lived access token.
 * Called automatically by the GraphQL client on UNAUTHENTICATED errors.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const res = await fetch(graphqlEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward the refresh cookie as the Authorization header (simple approach)
      // so the API resolver can read it
      Authorization: `Bearer dummy`, // bypasses Apollo's missing auth header check
      Cookie: `refresh_token=${refreshToken}`,
      // See @/lib/internal-api for why we set Origin on BFF→API calls.
      Origin: internalOrigin(request),
    },
    body: JSON.stringify({
      query: `
        mutation RefreshToken {
          refreshToken {
            token
            refreshToken
            accessTokenMaxAge
            refreshTokenMaxAge
            user {
              id
              email
              username
              role
            }
          }
        }
      `,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.errors?.length) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
  }

  const {
    token,
    refreshToken: newRefreshToken,
    user,
    accessTokenMaxAge,
    refreshTokenMaxAge,
  }: {
    token: string;
    refreshToken?: string;
    user: unknown;
    accessTokenMaxAge?: number | null;
    refreshTokenMaxAge?: number | null;
  } = data.data.refreshToken;

  const response = NextResponse.json({ user });
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Cookie lifetime tracks the API's SiteSettings.accessTokenSeconds.
    maxAge: accessTokenMaxAge ?? FALLBACK_ACCESS_TOKEN_MAX_AGE,
    path: '/',
  });
  if (newRefreshToken) {
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshTokenMaxAge ?? FALLBACK_REFRESH_TOKEN_MAX_AGE,
      path: '/',
    });
  }

  return response;
}
