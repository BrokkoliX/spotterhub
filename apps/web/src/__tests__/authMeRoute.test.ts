import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// The route reads NEXT_PUBLIC_API_URL via @/lib/internal-api. Pin a value so
// `graphqlEndpoint()` is deterministic across machines.
process.env.NEXT_PUBLIC_API_URL = 'http://test-api:4000';

import { GET } from '@/app/api/auth/me/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a NextRequest carrying the supplied cookies. NextRequest's cookie
 * jar is populated from the standard `Cookie` header, so we construct one.
 */
function makeRequest(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return new NextRequest('http://localhost:3000/api/auth/me', {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

/**
 * Reads the Set-Cookie headers off a NextResponse and parses out a single
 * cookie's Max-Age. Returns null if the cookie wasn't set.
 */
function getSetCookieMaxAge(response: Response, name: string): number | null {
  const headers = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
  for (const raw of headers) {
    if (!raw.startsWith(`${name}=`)) continue;
    const m = raw.match(/Max-Age=(\d+)/i);
    if (m) return Number(m[1]);
  }
  return null;
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns user: null without any upstream call when neither cookie is present', async () => {
    const res = await GET(makeRequest({}));

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({ user: null });
  });

  it('returns the user when the access token is valid (no refresh attempted)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { me: { id: 'u1', username: 'alice' } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await GET(makeRequest({ access_token: 'good-jwt' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (fetchMock.mock.calls[0][1] as { body: string }).body;
    expect(body).toContain('query Me');
    await expect(res.json()).resolves.toEqual({ user: { id: 'u1', username: 'alice' } });
  });

  it('does NOT refresh on a non-auth upstream error (e.g. timeout / 500)', async () => {
    // Simulate a network-style failure on the `me` call.
    fetchMock.mockRejectedValueOnce(new Error('upstream timeout'));

    const res = await GET(makeRequest({ access_token: 'whatever', refresh_token: 'still-valid' }));

    // Only the `me` call was attempted; refresh was deliberately skipped
    // because the failure isn't an auth failure.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toEqual({ user: null });
  });

  it('self-heals via refresh when the access token returns UNAUTHENTICATED', async () => {
    // First call: `me` rejects the access token as expired.
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } }],
          data: { me: null },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    // Second call: `refreshToken` succeeds and returns rotated tokens.
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            refreshToken: {
              token: 'new-access',
              refreshToken: 'new-refresh',
              accessTokenMaxAge: 3600,
              refreshTokenMaxAge: 86400,
              user: { id: 'u1', username: 'alice' },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const res = await GET(
      makeRequest({ access_token: 'expired-jwt', refresh_token: 'still-valid' }),
    );

    // Both upstream calls happened, in the right order.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1] as { body: string }).body).toContain(
      'mutation RefreshToken',
    );

    await expect(res.json()).resolves.toEqual({ user: { id: 'u1', username: 'alice' } });

    // The rotated cookies were attached to the response, with Max-Ages
    // sourced from the API's payload (i.e. the configured SiteSettings
    // values, not the FALLBACK_* constants).
    expect(getSetCookieMaxAge(res, 'access_token')).toBe(3600);
    expect(getSetCookieMaxAge(res, 'refresh_token')).toBe(86400);
  });

  it('skips the `me` call entirely when only the refresh token is present', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            refreshToken: {
              token: 'new-access',
              refreshToken: 'new-refresh',
              accessTokenMaxAge: 3600,
              refreshTokenMaxAge: 86400,
              user: { id: 'u1' },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const res = await GET(makeRequest({ refresh_token: 'still-valid' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as { body: string }).body).toContain(
      'mutation RefreshToken',
    );
    await expect(res.json()).resolves.toEqual({ user: { id: 'u1' } });
  });

  it('clears both cookies when refresh also fails (idempotent logout)', async () => {
    // `me` returns UNAUTHENTICATED…
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } }],
          data: { me: null },
        }),
        { status: 200 },
      ),
    );
    // …and refresh ALSO fails (e.g. refresh-token row was deleted server-side).
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: 'Refresh token expired or invalid' }],
          data: null,
        }),
        { status: 200 },
      ),
    );

    const res = await GET(makeRequest({ access_token: 'expired', refresh_token: 'also-expired' }));

    await expect(res.json()).resolves.toEqual({ user: null });
    // Both cookies were cleared (Max-Age=0) so the next request takes the
    // fast no-cookies path instead of repeating the doomed refresh.
    expect(getSetCookieMaxAge(res, 'access_token')).toBe(0);
    expect(getSetCookieMaxAge(res, 'refresh_token')).toBe(0);
  });

  it('falls back to default Max-Age values when the API omits them on refresh', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            refreshToken: {
              token: 'new-access',
              refreshToken: 'new-refresh',
              // accessTokenMaxAge / refreshTokenMaxAge intentionally omitted —
              // simulates a deploy where the API is one version behind.
              user: { id: 'u1' },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const res = await GET(makeRequest({ refresh_token: 'still-valid' }));

    expect(getSetCookieMaxAge(res, 'access_token')).toBe(60 * 60); // FALLBACK_ACCESS_TOKEN_MAX_AGE
    expect(getSetCookieMaxAge(res, 'refresh_token')).toBe(7 * 24 * 60 * 60); // FALLBACK_REFRESH_TOKEN_MAX_AGE
  });
});
