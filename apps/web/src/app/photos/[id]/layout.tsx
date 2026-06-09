import type { Metadata } from 'next';

import { WEB_BASE, fetchPhotoForOG, fixLocalhostUrl } from '@/lib/og';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Server-only layout that wraps the client photo detail page and exports
 * generateMetadata. Provides per-photo Open Graph / Twitter Card tags so
 * shares on Facebook, X, LinkedIn, etc. render a rich preview with the photo
 * image, aircraft, and photographer.
 *
 * The photo page is a client component (urql useQuery + hooks), so it cannot
 * export generateMetadata directly. A server layout solves this without
 * refactoring the page. The layout just passes children through.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchPhotoForOG(id);
  if (!data?.photo) {
    return { title: 'Photo' };
  }

  const p = data.photo;
  const display = p.variants?.find((v) => v.variantType === 'display') ?? p.variants?.[0];
  const image = fixLocalhostUrl(display?.url) ?? `${WEB_BASE}/opengraph-image`;

  const photographer = p.user?.username ? `@${p.user.username}` : p.photographerName;
  const title = p.caption ? p.caption : photographer ? `Photo by ${photographer}` : 'Photo';
  const description = p.aircraft?.registration
    ? `${p.aircraft.registration}${p.airline ? ` · ${p.airline}` : ''}${p.user?.username ? ` · @${p.user.username}` : ''}`
    : (p.caption ?? 'Aviation photo on SpotterSpace');
  const url = `${WEB_BASE}/photos/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      images: [
        {
          url: image,
          width: display?.width,
          height: display?.height,
          alt: p.caption ?? 'Aviation photo',
        },
      ],
      ...(p.takenAt ? { publishedTime: p.takenAt } : {}),
      ...(photographer ? { authors: [photographer] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function PhotoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
