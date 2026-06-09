import type { Metadata } from 'next';

import { WEB_BASE, fetchCommunityForOG, fixLocalhostUrl } from '@/lib/og';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Server-only layout that wraps the client community page. Provides per-
 * community Open Graph / Twitter Card tags. og:type=website (not article)
 * since communities are browseable destinations, not dated articles.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchCommunityForOG(slug);
  if (!data?.community) {
    return { title: 'Community' };
  }

  const c = data.community;
  const image = fixLocalhostUrl(c.bannerUrl) ?? `${WEB_BASE}/opengraph-image`;
  const title = c.name;
  const description = (
    c.description ?? `${c.memberCount.toLocaleString()} members on SpotterSpace`
  ).slice(0, 200);
  const url = `${WEB_BASE}/communities/${c.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: [{ url, alt: `${c.name} community banner` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
