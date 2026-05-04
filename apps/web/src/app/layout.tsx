import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Providers, type ServerAuthState } from '@/lib/providers';

import './globals.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Always render fresh auth state server-side (no stale data)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SpotterSpace — Aviation Photography Community',
  description:
    'The premier platform for aviation photographers to share, discover, and connect.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-side auth hydration: fetch user data before render to avoid hydration flash
  let serverAuth: ServerAuthState = { user: null };
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (accessToken) {
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
                sellerProfile { approved }
              }
            }
          `,
        }),
      });
      const data = await res.json();
      if (data.data?.me) {
        serverAuth = { user: data.data.me };
      }
    }
  } catch {
    // Auth fetch failed — client will revalidate via /api/auth/me
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);return;}if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
        {/*
          Google AdSense: set NEXT_PUBLIC_ADSENSE_CLIENT_ID env var to your ca-pub-XXXXXXXX
          in your AWS container environment (SSM Parameter Store or task definition).
          This loads the AdSense script globally. Slot-specific ads are rendered by
          the AdBanner component using per-slot IDs from the DB.
        */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? ''}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Providers serverAuth={serverAuth}>
          <Header />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
