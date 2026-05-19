'use client';

import Link from 'next/link';
import { use, useState } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);

  const [userResult] = useQuery({
    query: GET_USER,
    variables: { username },
  });

  const userId = userResult.data?.user?.id;

  const [photosResult] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, page: currentPage, userId },
    pause: !userId,
  });

  const { data: userData, fetching: userFetching } = userResult;
  const { data: photosData, fetching: photosFetching } = photosResult;
  const connection = photosResult.data?.photos;

  const photos: PhotoData[] =
    connection?.edges?.map(
          (e: { node: PhotoData }) => e.node,
        ) ?? [];

  const { user: authUser } = useAuth();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalCount = connection?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

        <div className={styles.tabs}>
          <Link
            href={`/u/${username}/photos`}
            className={`${styles.tab} ${styles.tabActive}`}
          >
            Photos
          </Link>
          <Link
            href={`/u/${username}/albums`}
            className={styles.tab}
          >
            Albums
          </Link>
        </div>

        <PhotoGrid
          photos={photos}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          loading={photosFetching}
          emptyMessage={`${displayName} hasn't uploaded any photos yet`}
        />
      </div>
    </div>
  );
}
