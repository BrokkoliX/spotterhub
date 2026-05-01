import type { Metadata, Viewport } from 'next';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Providers } from '@/lib/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'SpotterSpace — Aviation Photography Community',
  description:
    'The premier platform for aviation photographers to share, discover, and connect.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <Providers>
          <Header />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
