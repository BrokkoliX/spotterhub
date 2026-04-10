'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use } from 'react';
import { useQuery } from 'urql';

import { FollowButton } from '@/components/FollowButton';
import { useAuth } from '@/lib/auth';
import { GET_ALBUMS, GET_USER } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AlbumVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

interface AlbumNode {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  photoCount: number;
  coverPhoto?: {
    id: string;
    variants: AlbumVariant[];
  } | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function UserAlbumsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { user: authUser } = useAuth();

  const [userResult] = useQuery({
    query: GET_USER,
    variables: { username },
  });

  const userId = userResult.data?.user?.id;

  const [albumsResult] = useQuery({
    query: GET_ALBUMS,
    variables: { userId, first: 50 },
    pause: !userId,
  });

  const { data: userData, fetching: userFetching } = userResult;

  const albums: AlbumNode[] =
    albumsResult.data?.albums?.edges?.map(
      (e: { node: AlbumNode }) => e.node,
    ) ?? [];

  // ─── Loading / Not Found ──────────────────────────────────────────────

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

        {/* Tabs */}
        <div className={styles.tabs}>
          <Link
            href={`/u/${username}/photos`}
            className={styles.tab}
          >
            Photos
          </Link>
          <Link
            href={`/u/${username}/albums`}
            className={`${styles.tab} ${styles.tabActive}`}
          >
            Albums
          </Link>
        </div>

        {/* Albums Grid */}
        {albumsResult.fetching && (
          <p className={styles.loading}>Loading albums…</p>
        )}

        {!albumsResult.fetching && albums.length === 0 && (
          <div className={styles.empty}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📸</div>
            <p>
              {isOwnProfile
                ? "You don't have any albums yet."
                : `${displayName} doesn't have any albums yet.`}
            </p>
            {isOwnProfile && (
              <Link href="/albums" className="btn btn-primary">
                Create an Album
              </Link>
            )}
          </div>
        )}

        {albums.length > 0 && (
          <div className={styles.grid}>
            {albums.map((album) => {
              const coverVariant = album.coverPhoto?.variants?.find(
                (v) => v.variantType === 'display',
              );

              return (
                <Link
                  key={album.id}
                  href={`/albums/${album.id}`}
                  className={styles.card}
                >
                  <div className={styles.coverWrapper}>
                    {coverVariant ? (
                      <Image
                        src={coverVariant.url}
                        alt={album.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className={styles.coverImage}
                      />
                    ) : (
                      <span className={styles.coverPlaceholder}>📷</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>
                      {album.title}
                      {!album.isPublic && (
                        <span className={styles.privateIcon} title="Private">
                          🔒
                        </span>
                      )}
                    </div>
                    <div className={styles.cardMeta}>
                      {album.photoCount}{' '}
                      {album.photoCount === 1 ? 'photo' : 'photos'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
