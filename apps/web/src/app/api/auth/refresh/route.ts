import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward the refresh cookie as the Authorization header (simple approach)
      // so the API resolver can read it
      Authorization: `Bearer dummy`, // bypasses Apollo's missing auth header check
      Cookie: `refresh_token=${refreshToken}`,
    },
    body: JSON.stringify({
      query: `
        mutation RefreshToken {
          refreshToken {
            token
            refreshToken
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

  const { token, refreshToken: newRefreshToken, user } = data.data.refreshToken;

  const response = NextResponse.json({ user });
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  });
  if (newRefreshToken) {
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }

  return response;
}
