'use client';

import { useCallback } from 'react';

import { type PhotoData } from './PhotoCard';
import { PhotoGrid } from './PhotoGrid';
import { useInfiniteScroll } from '@/lib/useInfiniteScroll';
import styles from './InfinitePhotoGrid.module.css';

interface InfinitePhotoGridProps {
  /** Photos accumulated so far */
  photos: PhotoData[];
  /** Cursor from pageInfo.endCursor of last response */
  endCursor: string | null;
  /** True when more pages exist */
  hasNextPage: boolean;
  /** Called with the next `after` cursor to fetch the next batch */
  onLoadMore: (after: string | null) => void;
  /** True while a fetch is in progress */
  loading: boolean;
  /** Passed through to PhotoGrid */
  viewMode?: 'grid' | 'list';
  /** Passed through to PhotoGrid */
  adSlotId?: string;
  /** Passed through to PhotoGrid (default: 12) */
  adInterval?: number;
  emptyMessage?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * A PhotoGrid that auto-loads more pages via infinite scroll.
 *
 * The sentinel element at the bottom triggers onLoadMore when it
 * enters the viewport. New pages are accumulated, not replaced.
 */
export function InfinitePhotoGrid({
  photos,
  endCursor,
  hasNextPage,
  onLoadMore,
  loading,
  viewMode = 'grid',
  adSlotId,
  adInterval = 12,
  emptyMessage = 'No photos yet',
  selectable,
  selectedIds,
  onToggleSelect,
}: InfinitePhotoGridProps) {
  const handleLoadMore = useCallback(() => {
    if (!loading && hasNextPage) {
      onLoadMore(endCursor);
    }
  }, [loading, hasNextPage, onLoadMore, endCursor]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    loading,
    hasNextPage,
  });

  return (
    <>
      <PhotoGrid
        photos={photos}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        loading={false}
        viewMode={viewMode}
        adSlotId={adSlotId}
        adInterval={adInterval}
        emptyMessage={emptyMessage}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
      />

      {/* Sentinel + loading indicator */}
      <div ref={sentinelRef} className={styles.sentinel}>
        {loading && (
          <div className={styles.loadingRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        )}
        {!hasNextPage && photos.length > 0 && (
          <p className={styles.endMarker}>— end of results —</p>
        )}
      </div>
    </>
  );
}
