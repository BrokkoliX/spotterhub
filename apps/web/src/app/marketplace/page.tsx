'use client';

import { useCallback, useState } from 'react';
import { useQuery } from 'urql';

import { PhotoGrid } from '@/components/PhotoGrid';
import type { PhotoData } from '@/components/PhotoCard';
import { MARKETPLACE_LISTINGS } from '@/lib/queries';

import styles from './page.module.css';

type SortOption = 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

const PAGE_SIZE = 24;

export default function MarketplacePage() {
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [{ data, fetching }] = useQuery({
    query: MARKETPLACE_LISTINGS,
    variables: { first: PAGE_SIZE, sortBy },
  });

  const listings = data?.marketplaceListings;
  const photos: PhotoData[] = listings?.edges.map((e: { node: PhotoData }) => e.node) ?? [];
  const hasNextPage = listings?.pageInfo?.hasNextPage ?? false;
  const endCursor = listings?.pageInfo?.endCursor;
  const totalCount = listings?.totalCount ?? 0;

  const handleLoadMore = useCallback(() => {
    // For now, simple pagination — could extend to use cursors
  }, []);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.heroEmoji}>🛒</div>
          <h1 className={styles.heroTitle}>Marketplace</h1>
          <p className={styles.heroSubtitle}>
            Buy and sell stunning aviation photography
          </p>
          {totalCount > 0 && (
            <p className={styles.listingCount}>
              {totalCount.toLocaleString()} photo{totalCount !== 1 ? 's' : ''} for sale
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.sortPills}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.sortPill} ${sortBy === opt.value ? styles.sortPillActive : ''}`}
                onClick={() => setSortBy(opt.value)}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {totalCount > 0 && (
            <span className={styles.totalCount}>
              {totalCount.toLocaleString()} listing{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Grid */}
        {fetching && photos.length === 0 ? (
          <p className={styles.loading}>Loading marketplace…</p>
        ) : (
          <PhotoGrid
            photos={photos}
            hasNextPage={hasNextPage}
            loading={fetching}
            onLoadMore={handleLoadMore}
            emptyMessage="No photos for sale yet"
            viewMode="grid"
          />
        )}
      </div>
    </div>
  );
}