'use client';

import { useCallback, useEffect, useRef } from 'react';

import { type PhotoData } from './PhotoCard';
import { PhotoGrid } from './PhotoGrid';
import type { FollowReason } from '@/lib/followReasons';
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
  /** Optional per-photo "via X" reasons, forwarded to PhotoGrid. */
  reasonsByPhotoId?: Record<string, FollowReason[]>;
}

/**
 * A PhotoGrid that auto-loads more pages via infinite scroll.
 *
 * The sentinel element at the bottom triggers onLoadMore when it
 * enters the viewport. New pages are accumulated, not replaced.
 *
 * Important: the trigger function passed into useInfiniteScroll is
 * stable across renders and reads the latest endCursor/onLoadMore
 * via a ref. This avoids re-instantiating the IntersectionObserver
 * on every render, which would otherwise re-fire intersection on
 * a sentinel that is still within rootMargin and cause a load loop.
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
  reasonsByPhotoId,
}: InfinitePhotoGridProps) {
  // Keep the latest endCursor + onLoadMore reachable from a stable trigger.
  const latestRef = useRef({ endCursor, onLoadMore });
  useEffect(() => {
    latestRef.current = { endCursor, onLoadMore };
  }, [endCursor, onLoadMore]);

  // Stable trigger: identity never changes (no deps), but each invocation
  // reads the freshest endCursor + onLoadMore from `latestRef`. This is read
  // only when the IntersectionObserver fires, never during render.
  const trigger = useCallback(() => {
    const { endCursor: cursor, onLoadMore: cb } = latestRef.current;
    cb(cursor);
  }, []);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: trigger,
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
        reasonsByPhotoId={reasonsByPhotoId}
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
