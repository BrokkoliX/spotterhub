import { NextRequest, NextResponse } from 'next/server';

import { graphqlEndpoint, internalOrigin } from '@/lib/internal-api';

// Fallbacks if the API ever omits the new cookie-lifetime fields (e.g. during
// a deploy where the API is one version behind). These match what the API
// hardcoded prior to making session timeouts configurable.
const FALLBACK_ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour
const FALLBACK_REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const res = await fetch(graphqlEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Server-to-server call from the Next.js BFF to the GraphQL API.
      // The API's csrfGuard rejects state-changing requests that lack both
      // Origin and Sec-Fetch-Site headers. Set Origin to our own web base URL
      // (which is on the API's allowed-origins list) so the BFF satisfies the
      // CSRF guard. There is no real CSRF threat here — the BFF only forwards
      // requests its own end users have already submitted with valid cookies —
      // but the guard cannot distinguish server-to-server traffic without an
      // explicit signal.
      Origin: internalOrigin(request),
    },
    body: JSON.stringify({
      query: `
        mutation SignIn($input: SignInInput!) {
          signIn(input: $input) {
            token
            refreshToken
            accessTokenMaxAge
            refreshTokenMaxAge
            user {
              id
              email
              username
              role
              sellerProfile {
                approved
                stripeOnboardingComplete
              }
            }
          }
        }
      `,
      variables: { input: { email, password } },
    }),
  });

  const data = await res.json();

  if (!res.ok || data.errors?.length) {
    const message = data.errors?.[0]?.message ?? 'Sign in failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const {
    token,
    refreshToken,
    user,
    accessTokenMaxAge,
    refreshTokenMaxAge,
  }: {
    token: string;
    refreshToken?: string;
    user: unknown;
    accessTokenMaxAge?: number | null;
    refreshTokenMaxAge?: number | null;
  } = data.data.signIn;

  const response = NextResponse.json({ user });
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Cookie lifetime is sourced from the API (SiteSettings.accessTokenSeconds)
    // so the cookie expires in lockstep with the JWT it carries.
    maxAge: accessTokenMaxAge ?? FALLBACK_ACCESS_TOKEN_MAX_AGE,
    path: '/',
  });
  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshTokenMaxAge ?? FALLBACK_REFRESH_TOKEN_MAX_AGE,
      path: '/',
    });
  }

  return response;
}
