'use client';

import Link from 'next/link';
import { use, useCallback, useState } from 'react';
import { useQuery } from 'urql';

import { FollowButton } from '@/components/FollowButton';
import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import { GET_PHOTOS, GET_USER } from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 12;

export default function UserPhotosPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);

  const [userResult] = useQuery({
    query: GET_USER,
    variables: { username },
  });

  const userId = userResult.data?.user?.id;

  const [photosResult] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, after: cursor, userId },
    pause: !userId,
  });

  const { data: userData, fetching: userFetching } = userResult;
  const { data: photosData, fetching: photosFetching } = photosResult;
  const connection = photosData?.photos;

  const photos: PhotoData[] =
    allPhotos.length > 0
      ? allPhotos
      : connection?.edges?.map(
            (e: { node: PhotoData }) => e.node,
          ) ?? [];

  const { user: authUser } = useAuth();

  const handleLoadMore = useCallback(() => {
    if (connection?.pageInfo?.endCursor) {
      setAllPhotos((prev) => {
        const current =
          connection?.edges?.map(
            (e: { node: PhotoData }) => e.node,
          ) ?? [];
        return prev.length > 0 ? prev : current;
      });
      setCursor(connection.pageInfo.endCursor);
    }
  }, [connection]);

  // Append new pages
  if (
    photosData &&
    cursor &&
    connection?.edges?.length > 0 &&
    allPhotos.length > 0
  ) {
    const newPhotos = connection.edges.map(
      (e: { node: PhotoData }) => e.node,
    );
    const firstNewId = newPhotos[0]?.id;
    if (!allPhotos.some((p: PhotoData) => p.id === firstNewId)) {
      setAllPhotos((prev) => [...prev, ...newPhotos]);
    }
  }

  if (userFetching) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!userData?.user) {
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

  const user = userData.user;
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
                <FollowButton
                  userId={user.id}
                  initialIsFollowing={user.isFollowedByMe}
                />
              )}
            </div>
            <p className={styles.username}>@{user.username}</p>
            <div className={styles.profileStats}>
              <span className={styles.profileStat}>
                <span className={styles.profileStatValue}>
                  {user.photoCount}
                </span>{' '}
                photos
              </span>
              <span className={styles.profileStat}>
                <span className={styles.profileStatValue}>
                  {user.followerCount}
                </span>{' '}
                followers
              </span>
              <span className={styles.profileStat}>
                <span className={styles.profileStatValue}>
                  {user.followingCount}
                </span>{' '}
                following
              </span>
            </div>
          </div>
        </div>

        <p className={styles.sectionTitle}>Photos</p>

        <PhotoGrid
          photos={photos}
          hasNextPage={connection?.pageInfo?.hasNextPage ?? false}
          loading={photosFetching}
          onLoadMore={handleLoadMore}
          emptyMessage={`${displayName} hasn't uploaded any photos yet`}
        />
      </div>
    </div>
  );
}
