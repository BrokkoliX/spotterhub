import { NextRequest, NextResponse } from 'next/server';

import { graphqlEndpoint, internalOrigin } from '@/lib/internal-api';

// Prevent Next.js from caching this response so the client always gets fresh auth state
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cap upstream wait so a stalled API can't pin the user's browser tab open.
// On timeout/error we return `user: null`; the UI treats this the same as
// logged-out and the next API call will surface the real auth error if any.
const ME_TIMEOUT_MS = 3000;

// Fallbacks if the API ever omits the cookie-lifetime fields on a refresh
// (e.g. during a deploy where the API is one version behind). Match the
// values that were hardcoded prior to making session timeouts configurable.
const FALLBACK_ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour
const FALLBACK_REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Calls the GraphQL `me` query with the supplied access token and returns
 * the user, or null on auth failure / network error / timeout.
 */
async function fetchMe(
  request: NextRequest,
  accessToken: string,
): Promise<{ ok: true; user: unknown } | { ok: false; unauthenticated: boolean }> {
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
      // Distinguish UNAUTHENTICATED (recoverable via refresh) from any other
      // error (which we surface as user: null without attempting refresh).
      const isUnauthenticated = data.errors.some(
        (e: { extensions?: { code?: string } }) => e.extensions?.code === 'UNAUTHENTICATED',
      );
      return { ok: false, unauthenticated: isUnauthenticated };
    }

    return { ok: true, user: data.data.me };
  } catch {
    // Upstream timeout, network error, or malformed JSON. Treat as
    // non-recoverable; client retries on next route change.
    return { ok: false, unauthenticated: false };
  }
}

/**
 * Calls the GraphQL `refreshToken` mutation using the refresh-token cookie.
 * On success, returns the new access/refresh tokens, the user, and the
 * cookie Max-Age values (sourced from SiteSettings on the API side).
 *
 * This is the self-healing path that lets a user with an expired access
 * token but a valid refresh token stay logged-in without bouncing through
 * /signin. Without this, anything that reads auth state via /api/auth/me
 * (the AuthProvider on every mount, the SSR layout fallback, …) would see
 * the expired access cookie, return user: null, and the UI would render as
 * logged-out — even though urql's authExchange would have happily refreshed
 * on the next GraphQL call. The asymmetry is what produced the user-visible
 * "logged out every ~1h of activity" symptom.
 */
async function tryRefresh(
  request: NextRequest,
  refreshToken: string,
): Promise<
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      user: unknown;
      accessTokenMaxAge: number;
      refreshTokenMaxAge: number;
    }
  | { ok: false }
> {
  try {
    const res = await fetch(graphqlEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The API's auth context expects an Authorization header for state-
        // changing operations even when the real credential is the cookie.
        // The refresh resolver reads the refresh token from the forwarded
        // Cookie header, not from the bearer token, so a placeholder is fine.
        Authorization: `Bearer dummy`,
        Cookie: `refresh_token=${refreshToken}`,
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
                sellerProfile {
                  approved
                }
              }
            }
          }
        `,
      }),
      signal: AbortSignal.timeout(ME_TIMEOUT_MS),
    });

    const data = await res.json();
    if (!res.ok || data.errors?.length || !data.data?.refreshToken) {
      return { ok: false };
    }

    const payload = data.data.refreshToken as {
      token: string;
      refreshToken?: string;
      user: unknown;
      accessTokenMaxAge?: number | null;
      refreshTokenMaxAge?: number | null;
    };

    if (!payload.refreshToken) {
      // The API should always rotate the refresh token, but if for any
      // reason it doesn't, we cannot complete the self-heal cycle (the old
      // refresh token has been deleted by the API's rotation logic, so we
      // have no way to recover). Treat as a refresh failure.
      return { ok: false };
    }

    return {
      ok: true,
      accessToken: payload.token,
      refreshToken: payload.refreshToken,
      user: payload.user,
      accessTokenMaxAge: payload.accessTokenMaxAge ?? FALLBACK_ACCESS_TOKEN_MAX_AGE,
      refreshTokenMaxAge: payload.refreshTokenMaxAge ?? FALLBACK_REFRESH_TOKEN_MAX_AGE,
    };
  } catch {
    return { ok: false };
  }
}

/**
 * GET /api/auth/me — returns the current authenticated user, or null.
 *
 * Self-healing flow:
 *   1. If access_token is present, try `me`. If it succeeds, return user.
 *   2. If `me` returns UNAUTHENTICATED (expired/invalid access token) AND
 *      a refresh_token cookie is present, attempt a `refreshToken`
 *      mutation. On success, set the rotated cookies and re-issue the
 *      user. On failure, return user: null.
 *   3. If access_token is missing but refresh_token is present, skip
 *      straight to step 2.
 *   4. If neither cookie is present, return user: null without any
 *      upstream calls.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Fast path: no cookies at all — definitely logged out.
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ user: null });
  }

  // Try the access token first when present. If it works, we're done in
  // a single round-trip and don't touch the refresh token (avoiding
  // unnecessary rotation churn).
  if (accessToken) {
    const meResult = await fetchMe(request, accessToken);
    if (meResult.ok) {
      return NextResponse.json({ user: meResult.user });
    }
    // Non-recoverable error (timeout, network, schema) — give up without
    // rotating the refresh token.
    if (!meResult.unauthenticated) {
      return NextResponse.json({ user: null });
    }
    // UNAUTHENTICATED — fall through to refresh attempt below.
  }

  // Either access token was missing or it's expired/invalid. Try to
  // self-heal via refresh.
  if (!refreshToken) {
    return NextResponse.json({ user: null });
  }

  const refreshResult = await tryRefresh(request, refreshToken);
  if (!refreshResult.ok) {
    // Refresh token is also invalid/expired. Clear both cookies so the
    // next request takes the fast no-cookies path instead of doing
    // another doomed refresh round-trip.
    const response = NextResponse.json({ user: null });
    response.cookies.set('access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  }

  // Refresh succeeded — set the rotated cookies and return the user.
  const response = NextResponse.json({ user: refreshResult.user });
  response.cookies.set('access_token', refreshResult.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshResult.accessTokenMaxAge,
    path: '/',
  });
  response.cookies.set('refresh_token', refreshResult.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshResult.refreshTokenMaxAge,
    path: '/',
  });
  return response;
}
