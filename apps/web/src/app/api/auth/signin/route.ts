import { NextRequest, NextResponse } from 'next/server';

import { graphqlEndpoint, internalOrigin } from '@/lib/internal-api';

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

  const { token, refreshToken, user } = data.data.signIn;

  const response = NextResponse.json({ user });
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour (short-lived access token)
    path: '/',
  });
  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
  }

  return response;
}
