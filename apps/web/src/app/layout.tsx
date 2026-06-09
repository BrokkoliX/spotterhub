import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';

import { Analytics } from '@/components/Analytics';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { getWebBase } from '@/lib/og';
import { Providers, type ServerAuthState } from '@/lib/providers';

import './globals.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Always render fresh auth state server-side (no stale data)
export const dynamic = 'force-dynamic';

// Request-aware metadata. Using generateMetadata (not a static const) so that
// metadataBase is derived from the request's host headers in production.
// The `WEB_BASE_URL` env var is supposed to be set by CDK, but the live task
// def doesn't include it (CDK/deploy split-brain), so we can't rely on a
// build-time constant — we have to read the host at request time.
export async function generateMetadata(): Promise<Metadata> {
  const webBase = await getWebBase();
  return {
    metadataBase: new URL(webBase),
    // Per-page generateMetadata returns just the leaf title; this template
    // appends the brand suffix automatically.
    title: {
      default: 'SpotterSpace — Aviation Photography Community',
      template: '%s — SpotterSpace',
    },
    description: 'The premier platform for aviation photographers to share, discover, and connect.',
    icons: {
      icon: '/logo.png',
    },
    openGraph: {
      type: 'website',
      siteName: 'SpotterSpace',
      title: 'SpotterSpace — Aviation Photography Community',
      description:
        'The premier platform for aviation photographers to share, discover, and connect.',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SpotterSpace — Aviation Photography Community',
      description:
        'The premier platform for aviation photographers to share, discover, and connect.',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-side auth hydration: fetch user data before render to avoid hydration flash.
  //
  // IMPORTANT: this runs on every page render (the layout is `force-dynamic`).
  // We MUST cap how long it can block, otherwise an upstream API stall (cold
  // start, DB burst throttle, deploy-in-progress) will hang the entire page
  // for minutes. On timeout/error we fall back to `user: null` and the client
  // re-hydrates via the `/api/auth/me` BFF route once it mounts.
  const SERVER_AUTH_TIMEOUT_MS = 3000;
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
        signal: AbortSignal.timeout(SERVER_AUTH_TIMEOUT_MS),
      });
      const data = await res.json();
      if (data.data?.me) {
        serverAuth = { user: data.data.me };
      }
    }
  } catch {
    // Auth fetch failed or timed out — client will revalidate via /api/auth/me.
    // Intentionally swallowed: server-side hydration is a UX nicety, not a
    // correctness boundary. Auth is enforced by the API on every GraphQL call.
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
        <Analytics />
        <Providers serverAuth={serverAuth}>
          <Header />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
