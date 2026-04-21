import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  const { token, user } = data.data.signIn;

  const response = NextResponse.json({ user });
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
