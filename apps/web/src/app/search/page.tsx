'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import { SEARCH_PHOTOS, SEARCH_USERS } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'photos' | 'users';

interface UserResult {
  id: string;
  username: string;
  photoCount: number;
  followerCount: number;
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
  } | null;
}

const PAGE_SIZE = 20;

// ─── Component ──────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: '48px 0', textAlign: 'center' }}>Loading…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<Tab>('photos');
  const [photosCursor, setPhotosCursor] = useState<string | null>(null);
  const [usersCursor, setUsersCursor] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);

  const hasQuery = searchQuery.length > 0;

  // ─── Queries ────────────────────────────────────────────────────────────

  const [photosResult] = useQuery({
    query: SEARCH_PHOTOS,
    variables: { query: searchQuery, first: PAGE_SIZE, after: photosCursor },
    pause: !hasQuery || activeTab !== 'photos',
  });

  const [usersResult] = useQuery({
    query: SEARCH_USERS,
    variables: { query: searchQuery, first: PAGE_SIZE, after: usersCursor },
    pause: !hasQuery || activeTab !== 'users',
  });

  // ─── Derived data ──────────────────────────────────────────────────────

  const photosConnection = photosResult.data?.searchPhotos;
  const photos: PhotoData[] =
    allPhotos.length > 0
      ? allPhotos
      : photosConnection?.edges?.map(
            (e: { node: PhotoData }) => e.node,
          ) ?? [];
  const photosTotalCount = photosConnection?.totalCount ?? 0;
  const photosHasMore = photosConnection?.pageInfo?.hasNextPage ?? false;

  const usersConnection = usersResult.data?.searchUsers;
  const users: UserResult[] =
    allUsers.length > 0
      ? allUsers
      : usersConnection?.edges?.map(
            (e: { node: UserResult }) => e.node,
          ) ?? [];
  const usersTotalCount = usersConnection?.totalCount ?? 0;
  const usersHasMore = usersConnection?.pageInfo?.hasNextPage ?? false;

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = inputValue.trim();
      if (!q) return;
      setSearchQuery(q);
      setPhotosCursor(null);
      setUsersCursor(null);
      setAllPhotos([]);
      setAllUsers([]);
    },
    [inputValue],
  );

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  const handleLoadMorePhotos = useCallback(() => {
    if (photosConnection?.pageInfo?.endCursor) {
      setAllPhotos((prev) => [...(prev.length > 0 ? prev : photos)]);
      setPhotosCursor(photosConnection.pageInfo.endCursor);
    }
  }, [photosConnection, photos]);

  const handleLoadMoreUsers = useCallback(() => {
    if (usersConnection?.pageInfo?.endCursor) {
      setAllUsers((prev) => [...(prev.length > 0 ? prev : users)]);
      setUsersCursor(usersConnection.pageInfo.endCursor);
    }
  }, [usersConnection, users]);

  // Merge new pages
  const mergedPhotos: PhotoData[] =
    allPhotos.length > 0 && photosConnection?.edges
      ? [
          ...allPhotos,
          ...photosConnection.edges
            .map((e: { node: PhotoData }) => e.node)
            .filter(
              (p: PhotoData) => !allPhotos.some((ap) => ap.id === p.id),
            ),
        ]
      : photos;

  const mergedUsers: UserResult[] =
    allUsers.length > 0 && usersConnection?.edges
      ? [
          ...allUsers,
          ...usersConnection.edges
            .map((e: { node: UserResult }) => e.node)
            .filter(
              (u: UserResult) => !allUsers.some((au) => au.id === u.id),
            ),
        ]
      : users;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Search</h1>

        {/* Search bar */}
        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input
            type="text"
            className={styles.searchInput}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search photos, aircraft, airlines, airports, users…"
            autoFocus
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>

        {!hasQuery && (
          <div className={styles.prompt}>
            <div className={styles.icon}>🔍</div>
            <h2>Find photos and spotters</h2>
            <p>Search by aircraft type, airline, airport code, tags, or username.</p>
          </div>
        )}

        {hasQuery && (
          <>
            {/* Tabs */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'photos' ? styles.tabActive : ''}`}
                onClick={() => handleTabChange('photos')}
              >
                Photos{photosConnection ? ` (${photosTotalCount})` : ''}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`}
                onClick={() => handleTabChange('users')}
              >
                Users{usersConnection ? ` (${usersTotalCount})` : ''}
              </button>
            </div>

            {/* Photo Results */}
            {activeTab === 'photos' && (
              <>
                {photosResult.fetching && mergedPhotos.length === 0 && (
                  <p className={styles.loading}>Searching…</p>
                )}
                {!photosResult.fetching && mergedPhotos.length === 0 && (
                  <div className={styles.empty}>
                    <h2>No photos found</h2>
                    <p>Try different keywords or check the Users tab.</p>
                  </div>
                )}
                {mergedPhotos.length > 0 && (
                  <PhotoGrid
                    photos={mergedPhotos}
                    hasNextPage={photosHasMore}
                    loading={photosResult.fetching}
                    onLoadMore={handleLoadMorePhotos}
                    emptyMessage="No photos found"
                  />
                )}
              </>
            )}

            {/* User Results */}
            {activeTab === 'users' && (
              <>
                {usersResult.fetching && mergedUsers.length === 0 && (
                  <p className={styles.loading}>Searching…</p>
                )}
                {!usersResult.fetching && mergedUsers.length === 0 && (
                  <div className={styles.empty}>
                    <h2>No users found</h2>
                    <p>Try a different name or username.</p>
                  </div>
                )}
                {mergedUsers.length > 0 && (
                  <div className={styles.userList}>
                    {mergedUsers.map((u) => (
                      <Link
                        key={u.id}
                        href={`/u/${u.username}/photos`}
                        className={styles.userCard}
                      >
                        <div className={styles.userAvatar}>
                          {u.profile?.avatarUrl ? (
                            <img
                              src={u.profile.avatarUrl}
                              alt={u.username}
                            />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>
                            {u.profile?.displayName ?? u.username}
                          </div>
                          <div className={styles.userHandle}>@{u.username}</div>
                          {u.profile?.bio && (
                            <div className={styles.userBio}>{u.profile.bio}</div>
                          )}
                        </div>
                        <div className={styles.userStats}>
                          <span>{u.photoCount} photos</span>
                          <span>{u.followerCount} followers</span>
                        </div>
                      </Link>
                    ))}
                    {usersHasMore && (
                      <div className={styles.loadMore}>
                        <button
                          type="button"
                          className={styles.loadMoreBtn}
                          onClick={handleLoadMoreUsers}
                          disabled={usersResult.fetching}
                        >
                          {usersResult.fetching ? 'Loading…' : 'Load more'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
