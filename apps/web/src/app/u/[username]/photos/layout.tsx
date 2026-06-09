import type { Metadata } from 'next';

import { fetchUserForOG, getWebBase } from '@/lib/og';

interface Props {
  params: Promise<{ username: string }>;
}

/**
 * Server-only layout for /u/[username]/photos. The page is a client component
 * (urql useQuery), so metadata is provided via this server layout.
 *
 * We deliberately skip the user's avatar as og:image — avatars are small
 * (typically 200x200) and would look poor when upscaled to 1200x630 by
 * crawlers. Falling back to the site default is cleaner.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const webBase = await getWebBase();
  const data = await fetchUserForOG(username);
  if (!data?.user) {
    return { title: username };
  }

  const u = data.user;
  const display = u.profile?.displayName ?? u.username;
  const title = display;
  const description = (u.profile?.bio ?? `Photos by @${u.username} on SpotterSpace`).slice(0, 200);
  const url = `${webBase}/u/${encodeURIComponent(u.username)}/photos`;
  const image = `${webBase}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      url,
      title,
      description,
      username: u.username,
      images: [{ url: image, alt: `${display} on SpotterSpace` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function UserPhotosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
