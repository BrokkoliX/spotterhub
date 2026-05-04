import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Prevent Next.js from caching this response so the client always gets fresh auth state
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
            sellerProfile {
              approved
            }
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
