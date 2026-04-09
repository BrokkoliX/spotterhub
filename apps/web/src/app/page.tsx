'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import { GET_FOLLOWING_FEED, GET_PHOTOS } from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 12;

type FeedTab = 'recent' | 'following';

export default function HomePage() {
  const { user } = useAuth();
  const [feedTab, setFeedTab] = useState<FeedTab>('recent');
  const [recentCursor, setRecentCursor] = useState<string | null>(null);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<PhotoData[]>([]);
  const [followingPhotos, setFollowingPhotos] = useState<PhotoData[]>([]);

  const cursor = feedTab === 'recent' ? recentCursor : followingCursor;

  const [recentResult] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, after: recentCursor },
    pause: feedTab !== 'recent',
  });

  const [followingResult] = useQuery({
    query: GET_FOLLOWING_FEED,
    variables: { first: PAGE_SIZE, after: followingCursor },
    pause: feedTab !== 'following' || !user,
  });

  const result = feedTab === 'recent' ? recentResult : followingResult;
  const { data, fetching, error } = result;
  const connection = feedTab === 'recent' ? data?.photos : data?.followingFeed;
  const allPhotos = feedTab === 'recent' ? recentPhotos : followingPhotos;
  const setAllPhotos = feedTab === 'recent' ? setRecentPhotos : setFollowingPhotos;

  const photos: PhotoData[] =
    allPhotos.length > 0
      ? allPhotos
      : connection?.edges?.map(
            (e: { node: PhotoData }) => e.node,
          ) ?? [];

  const handleLoadMore = useCallback(() => {
    if (connection?.pageInfo?.endCursor) {
      setAllPhotos((prev: PhotoData[]) => {
        const current =
          connection?.edges?.map(
            (e: { node: PhotoData }) => e.node,
          ) ?? [];
        const existing = prev.length > 0 ? prev : current;
        return existing;
      });
      if (feedTab === 'recent') {
        setRecentCursor(connection.pageInfo.endCursor);
      } else {
        setFollowingCursor(connection.pageInfo.endCursor);
      }
    }
  }, [connection, feedTab, setAllPhotos]);

  // When new data arrives after cursor change, append to allPhotos
  if (
    data &&
    cursor &&
    connection?.edges?.length > 0 &&
    allPhotos.length > 0
  ) {
    const newPhotos = connection.edges.map(
      (e: { node: PhotoData }) => e.node,
    );
    const lastId = allPhotos[allPhotos.length - 1]?.id;
    const firstNewId = newPhotos[0]?.id;
    if (lastId !== firstNewId && !allPhotos.some((p: PhotoData) => p.id === firstNewId)) {
      setAllPhotos((prev: PhotoData[]) => [...prev, ...newPhotos]);
    }
  }

  const handleTabChange = (tab: FeedTab) => {
    setFeedTab(tab);
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>
            {feedTab === 'recent' ? 'Recent Photos' : 'Following Feed'}
          </h1>
          <p className={styles.subtitle}>
            {feedTab === 'recent'
              ? 'The latest aviation photography from the community'
              : 'Photos from people, airports, and topics you follow'}
          </p>
        </div>

        {/* Feed Toggle */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${feedTab === 'recent' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('recent')}
          >
            Recent
          </button>
          <button
            type="button"
            className={`${styles.tab} ${feedTab === 'following' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('following')}
          >
            Following
          </button>
        </div>

        {/* Sign-in prompt for unauthenticated users on Following tab */}
        {feedTab === 'following' && !user && (
          <div className={styles.signInPrompt}>
            <p>
              <Link href="/signin">Sign in</Link> to see photos from people,
              airports, and topics you follow.
            </p>
          </div>
        )}

        {error && (
          <p className={styles.error}>
            Failed to load photos. Is the API running?
          </p>
        )}

        {fetching && photos.length === 0 && (
          <p className={styles.loading}>Loading photos…</p>
        )}

        {(feedTab === 'recent' || user) && (
          <PhotoGrid
            photos={photos}
            hasNextPage={connection?.pageInfo?.hasNextPage ?? false}
            loading={fetching}
            onLoadMore={handleLoadMore}
            emptyMessage={
              feedTab === 'following'
                ? 'No photos yet. Follow users, airports, or topics to build your feed!'
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
