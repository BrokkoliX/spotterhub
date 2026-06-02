'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  /** True while a new page is being fetched */
  loading: boolean;
  /** Set to false when there are no more pages */
  hasNextPage: boolean;
  /** Root element to use as viewport (defaults to window) */
  root?: HTMLElement | null;
  /** IntersectionObserver threshold */
  threshold?: number;
}

/**
 * Attaches an IntersectionObserver to a sentinel element.
 * Fires onLoadMore when the sentinel enters the viewport,
 * as long as loading is false and hasNextPage is true.
 *
 * Returns a ref to attach to the sentinel div.
 */
export function useInfiniteScroll({
  onLoadMore,
  loading,
  hasNextPage,
  root = null,
  threshold = 0.1,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Rebuild the observer whenever the sentinel element changes
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !loading) {
        onLoadMore();
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root,
      threshold,
      rootMargin: '200px',
    });

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [root, threshold, hasNextPage, loading, onLoadMore]);

  return sentinelRef;
}
