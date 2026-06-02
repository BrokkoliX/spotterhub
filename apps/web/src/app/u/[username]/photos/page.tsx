'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useState } from 'react';
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

  const userId = userResult.data?.user?.id;

  const [{ data: photosData, fetching: photosFetching }, reexecutePhotos] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, after: endCursor, userId },
    pause: !userId,
  });

  // Sync accumulated state
  useEffect(() => {
    const conn = photosData?.photos;
    if (!conn) return;
    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const cursor = conn.pageInfo?.endCursor ?? null;
    const hasMore = conn.pageInfo?.hasNextPage ?? false;

    setPhotos((prev) => (endCursor === null ? newPhotos : [...prev, ...newPhotos]));
    setEndCursor(cursor);
    setHasNextPage(hasMore);
  }, [photosData, endCursor]);

  const handleLoadMore = useCallback(() => {
    if (!photosFetching && hasNextPage) {
      reexecutePhotos({ requestPolicy: 'network-only' });
    }
  }, [photosFetching, hasNextPage, reexecutePhotos]);

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

  if (!userResult.data?.user) {
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

  const user = userResult.data.user;
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
