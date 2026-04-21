import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ user: null });
  }

  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `
        query Me {
          me {
            id
            email
            username
            role
          }
        }
      `,
    }),
  });

  const data = await res.json();

  if (data.errors?.length) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: data.data.me });
}
