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
  // Temporary debug log: confirm this function is being called at request
  // time. Grep CloudWatch logs for "[photo-og]" to verify.
  console.log('[photo-og] generateMetadata called for id:', id, 'WEB_BASE:', WEB_BASE);
  const data = await fetchPhotoForOG(id);
  console.log('[photo-og] fetchPhotoForOG result:', data?.photo ? 'found' : 'null');
  if (!data?.photo) {
    // Fallback when the photo can't be fetched (API down, photo deleted, or
    // GraphQL error). Include the default site image explicitly — the
    // file-convention auto-injection in app/opengraph-image.tsx is suppressed
    // when a child route's generateMetadata sets its own openGraph block.
    const url = `${WEB_BASE}/photos/${id}`;
    const fallbackImage = `${WEB_BASE}/opengraph-image`;
    return {
      title: 'Photo',
      description: 'View this photo on SpotterSpace',
      alternates: { canonical: url },
      openGraph: {
        type: 'article',
        url,
        title: 'Photo',
        description: 'View this photo on SpotterSpace',
        images: [{ url: fallbackImage, width: 1200, height: 630, alt: 'SpotterSpace' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Photo',
        description: 'View this photo on SpotterSpace',
        images: [fallbackImage],
      },
    };
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
