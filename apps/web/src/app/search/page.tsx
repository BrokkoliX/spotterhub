'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery } from 'urql';

import type { PhotoData } from '@/components/PhotoCard';
import { Pagination } from '@/components/Pagination';
import { InfinitePhotoGrid } from '@/components/InfinitePhotoGrid';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<Tab>('photos');
  const [usersPage, setUsersPage] = useState(1);

  // Infinite scroll state for photos
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);

  const hasQuery = searchQuery.length > 0;

  // ─── Queries ────────────────────────────────────────────────────────────

  const [{ data: photosData, fetching: photosFetching }, reexecutePhotos] = useQuery({
    query: SEARCH_PHOTOS,
    variables: { query: searchQuery, first: PAGE_SIZE, after: endCursor },
    pause: !hasQuery || activeTab !== 'photos',
  });

  const [usersResult] = useQuery({
    query: SEARCH_USERS,
    variables: { query: searchQuery, first: PAGE_SIZE, page: usersPage },
    pause: !hasQuery || activeTab !== 'users',
  });

  // Sync accumulated photo state
  useEffect(() => {
    if (activeTab !== 'photos') return;
    const conn = photosData?.searchPhotos;
    if (!conn) return;
    const newPhotos: PhotoData[] = conn.edges?.map((e: { node: PhotoData }) => e.node) ?? [];
    const cursor = conn.pageInfo?.endCursor ?? null;
    const hasMore = conn.pageInfo?.hasNextPage ?? false;

    setPhotos((prev) => (endCursor === null ? newPhotos : [...prev, ...newPhotos]));
    setEndCursor(cursor);
    setHasNextPage(hasMore);
  }, [photosData, activeTab, endCursor]);

  const handleLoadMorePhotos = useCallback(() => {
    if (!photosFetching && hasNextPage) {
      reexecutePhotos({ requestPolicy: 'network-only' });
    }
  }, [photosFetching, hasNextPage, reexecutePhotos]);

  // ─── Derived data ──────────────────────────────────────────────────────

  const photosConnection = photosData?.searchPhotos;
  const photosTotalCount = photosConnection?.totalCount ?? 0;

  const usersConnection = usersResult.data?.searchUsers;
  const users: UserResult[] =
    usersConnection?.edges?.map((e: { node: UserResult }) => e.node) ?? [];
  const usersTotalCount = usersConnection?.totalCount ?? 0;

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = inputValue.trim();
      if (!q) return;
      setSearchQuery(q);
      setPhotos([]);
      setEndCursor(null);
      setHasNextPage(true);
      setUsersPage(1);
      router.push(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
    },
    [inputValue, router],
  );

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  const handleUsersPageChange = (page: number) => {
    setUsersPage(page);
    router.push(`/search?${searchParams.toString()}`, { scroll: false });
  };

  const usersTotalPages = Math.ceil(usersTotalCount / PAGE_SIZE);

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
                {photosFetching && photos.length === 0 && (
                  <p className={styles.loading}>Searching…</p>
                )}
                {!photosFetching && photos.length === 0 && (
                  <div className={styles.empty}>
                    <h2>No photos found</h2>
                    <p>Try different keywords or check the Users tab.</p>
                  </div>
                )}
                {photos.length > 0 && (
                  <InfinitePhotoGrid
                    photos={photos}
                    endCursor={endCursor}
                    hasNextPage={hasNextPage}
                    onLoadMore={handleLoadMorePhotos}
                    loading={photosFetching}
                    emptyMessage="No photos found"
                  />
                )}
              </>
            )}

            {/* User Results */}
            {activeTab === 'users' && (
              <>
                {usersResult.fetching && users.length === 0 && (
                  <p className={styles.loading}>Searching…</p>
                )}
                {!usersResult.fetching && users.length === 0 && (
                  <div className={styles.empty}>
                    <h2>No users found</h2>
                    <p>Try a different name or username.</p>
                  </div>
                )}
                {users.length > 0 && (
                  <div className={styles.userList}>
                    {users.map((u) => (
                      <Link key={u.id} href={`/u/${u.username}/photos`} className={styles.userCard}>
                        <div className={styles.userAvatar}>
                          {u.profile?.avatarUrl ? (
                            <img src={u.profile.avatarUrl} alt={u.username} />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>
                            {u.profile?.displayName ?? u.username}
                          </div>
                          <div className={styles.userHandle}>@{u.username}</div>
                          {u.profile?.bio && <div className={styles.userBio}>{u.profile.bio}</div>}
                        </div>
                        <div className={styles.userStats}>
                          <span>{u.photoCount} photos</span>
                          <span>{u.followerCount} followers</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {usersTotalPages > 1 && (
                  <Pagination
                    currentPage={usersPage}
                    totalPages={usersTotalPages}
                    onPageChange={handleUsersPageChange}
                    loading={usersResult.fetching}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
