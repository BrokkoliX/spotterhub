'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';

import { FollowButton } from '@/components/FollowButton';
import type { PhotoData } from '@/components/PhotoCard';
import { InfinitePhotoGrid } from '@/components/InfinitePhotoGrid';
import { useAuth } from '@/lib/auth';
import { GET_PHOTOS, GET_USER } from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 12;

function getBadgeCategoryIcon(category: string): string {
  switch (category) {
    case 'UPLOAD':
      return '📸';
    case 'ENGAGEMENT':
      return '❤️';
    case 'COMMUNITY':
      return '🤝';
    case 'STREAK':
      return '🔥';
    case 'DIVERSITY':
      return '🌍';
    case 'AWARD':
      return '🏆';
    default:
      return '🏅';
  }
}

// ─── Social Links ─────────────────────────────────────────────────────────

interface ProfileSocialLinks {
  instagramHandle?: string | null;
  facebookUrl?: string | null;
  xHandle?: string | null;
}

/**
 * Render a compact icon-only row of social links beneath the profile header.
 * Returns null when the user has not set any social link, so the row only
 * occupies vertical space when there is something to show.
 *
 * Outbound links use rel="me noopener noreferrer" — `me` is the standard
 * IndieWeb annotation for self-identifying profile links and is harmless on
 * platforms that don't consume it; `noopener noreferrer` is required when
 * opening user-supplied URLs in a new tab.
 */
function SocialLinks({ profile }: { profile: ProfileSocialLinks }) {
  const items: Array<{ key: string; label: string; href: string; icon: React.ReactElement }> = [];

  if (profile.instagramHandle) {
    items.push({
      key: 'instagram',
      label: `Instagram: @${profile.instagramHandle}`,
      href: `https://www.instagram.com/${encodeURIComponent(profile.instagramHandle)}/`,
      icon: <InstagramIcon />,
    });
  }
  if (profile.xHandle) {
    items.push({
      key: 'x',
      label: `X: @${profile.xHandle}`,
      href: `https://x.com/${encodeURIComponent(profile.xHandle)}`,
      icon: <XIcon />,
    });
  }
  if (profile.facebookUrl) {
    items.push({
      key: 'facebook',
      label: 'Facebook',
      href: profile.facebookUrl,
      icon: <FacebookIcon />,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className={styles.socialLinks} aria-label="Social media links">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="me noopener noreferrer"
          className={styles.socialLink}
          aria-label={item.label}
          title={item.label}
        >
          {item.icon}
        </a>
      ))}
    </div>
  );
}

// Inline SVG icons keep the bundle small (no icon library) and inherit
// `currentColor` so they restyle automatically with the surrounding text.

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.53 3H20.5l-6.55 7.49L21.75 21h-6.03l-4.72-6.18L5.6 21H2.62l7.01-8.02L2.25 3h6.18l4.27 5.65L17.53 3Zm-1.06 16.2h1.66L7.6 4.7H5.84l10.63 14.5Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.49-1.46H17V4.45A21 21 0 0 0 14.86 4.3c-2.13 0-3.6 1.3-3.6 3.69V10.5H8.6v3h2.66V21h2.24Z" />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function UserPhotosPage({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className="container">
            <p className={styles.loading}>Loading…</p>
          </div>
        </div>
      }
    >
      <UserPhotosPageInner params={params} />
    </Suspense>
  );
}

function UserPhotosPageInner({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const searchParams = useSearchParams();
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);

  const [{ data: userResult, fetching: userFetching }] = useQuery({
    query: GET_USER,
    variables: { username },
  });

  const userId = userResult?.user?.id;

  const [{ data: photosData, fetching: photosFetching }] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, after: endCursor, userId },
    pause: !userId,
  });

  // Sync accumulated state.
  //
  // IMPORTANT: do NOT advance `endCursor` from this effect. `endCursor` is the
  // cursor we hand to urql via `variables.after`, so writing it here would
  // trigger an immediate re-fetch — and the next response would then advance
  // it again, ad infinitum. Instead, we record the response's end cursor in a
  // ref and let `handleLoadMore` promote it to state when the user actually
  // wants the next page.
  const lastResponseCursorRef = useRef<string | null>(null);
  const lastMergedCursorRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const conn = photosData?.photos;
    if (!conn) return;
    const cursor = conn.pageInfo?.endCursor ?? null;
    if (lastMergedCursorRef.current === cursor && cursor !== null) return;

    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const hasMore = conn.pageInfo?.hasNextPage ?? false;

    setPhotos((prev) => (endCursor === null ? newPhotos : [...prev, ...newPhotos]));
    setHasNextPage(hasMore);
    lastResponseCursorRef.current = cursor;
    lastMergedCursorRef.current = cursor;
  }, [photosData, endCursor]);

  const handleLoadMore = useCallback(() => {
    if (photosFetching || !hasNextPage) return;
    const next = lastResponseCursorRef.current;
    if (next === null || next === endCursor) return;
    setEndCursor(next);
  }, [photosFetching, hasNextPage, endCursor]);

  const { user: authUser } = useAuth();

  if (userFetching) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!userResult?.user) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.notFound}>
            <p>User not found</p>
            <Link href="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
              Back to feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const user = userResult.user;
  const displayName = user.profile?.displayName ?? user.username;
  const isOwnProfile = authUser?.id === user.id;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Profile header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>
            {user.profile?.avatarUrl ? (
              <img
                src={user.profile.avatarUrl}
                alt={displayName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              '👤'
            )}
          </div>
          <div className={styles.info}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className={styles.displayName}>{displayName}</h1>
              {isOwnProfile && (
                <Link href="/settings/profile" className="btn btn-secondary">
                  Edit Profile
                </Link>
              )}
              {!isOwnProfile && (
                <FollowButton userId={user.id} initialIsFollowing={user.isFollowedByMe} />
              )}
            </div>
            <p className={styles.username}>@{user.username}</p>
            <div className={styles.profileStats}>
              <span className={styles.profileStat}>
                <span className={styles.profileStatValue}>{user.photoCount}</span> photos
              </span>
              <span className={styles.profileStat}>
                <span className={styles.profileStatValue}>{user.followerCount}</span> followers
              </span>
              <span className={styles.profileStat}>
                <span className={styles.profileStatValue}>{user.followingCount}</span> following
              </span>
            </div>
            {user.profile && <SocialLinks profile={user.profile} />}
          </div>
        </div>

        {/* Badges */}
        {user.badges && user.badges.length > 0 && (
          <div className={styles.badgeSection}>
            <h3 className={styles.badgeSectionTitle}>Badges</h3>
            <div className={styles.badgeGrid}>
              {user.badges.map(
                (ub: {
                  id: string;
                  awardedAt: string;
                  badgeDefinition: {
                    id: string;
                    slug: string;
                    name: string;
                    description: string;
                    category: string;
                    tier: string;
                  };
                }) => (
                  <div
                    key={ub.id}
                    className={`${styles.badgeItem} ${styles[`badgeTier${ub.badgeDefinition.tier.charAt(0) + ub.badgeDefinition.tier.slice(1).toLowerCase()}`]}`}
                    title={`${ub.badgeDefinition.name} (${ub.badgeDefinition.tier}) — ${ub.badgeDefinition.description}`}
                  >
                    <span className={styles.badgeIcon}>
                      {getBadgeCategoryIcon(ub.badgeDefinition.category)}
                    </span>
                    <span className={styles.badgeName}>{ub.badgeDefinition.name}</span>
                    <span className={styles.badgeTierLabel}>{ub.badgeDefinition.tier}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        <div className={styles.tabs}>
          <Link href={`/u/${username}/photos`} className={`${styles.tab} ${styles.tabActive}`}>
            Photos
          </Link>
          <Link href={`/u/${username}/albums`} className={styles.tab}>
            Albums
          </Link>
        </div>

        <InfinitePhotoGrid
          photos={photos}
          endCursor={endCursor}
          hasNextPage={hasNextPage}
          onLoadMore={handleLoadMore}
          loading={photosFetching}
          emptyMessage={`${displayName} hasn't uploaded any photos yet`}
        />
      </div>
    </div>
  );
}
