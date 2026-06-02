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
 * Returns a ref-callback to attach to the sentinel div.
 *
 * Implementation note: the observer is built **once per sentinel element**,
 * not on every prop change. The latest values of `onLoadMore`, `loading`,
 * and `hasNextPage` are read from refs inside the observer callback. This
 * prevents the observer from being torn down and recreated on every render
 * — recreating an IntersectionObserver against a target that is already
 * inside the rootMargin re-fires `isIntersecting` on the next tick, which
 * causes an infinite "load more → re-render → rebuild observer → fire
 * again" loop.
 */
export function useInfiniteScroll({
  onLoadMore,
  loading,
  hasNextPage,
  root = null,
  threshold = 0.1,
}: UseInfiniteScrollOptions) {
  // Hold the latest values in refs so the observer callback always sees
  // the current state without needing to be reconstructed.
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingRef = useRef(loading);
  const hasNextPageRef = useRef(hasNextPage);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
  }, [hasNextPage]);

  // The observer is owned per-sentinel. We use a ref-callback so React
  // tells us when the underlying DOM node changes (mount, unmount, key
  // change), and we only rebuild the observer in those cases.
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Tear down any previous observer when the sentinel detaches or
      // is replaced.
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry?.isIntersecting) return;
          if (loadingRef.current) return;
          if (!hasNextPageRef.current) return;
          onLoadMoreRef.current();
        },
        {
          root,
          threshold,
          rootMargin: '200px',
        },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [root, threshold],
  );

  // Disconnect on unmount as a safety net.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return sentinelRef;
}
