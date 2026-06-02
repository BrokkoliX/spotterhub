import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useInfiniteScroll } from '../lib/useInfiniteScroll';

// ─── IntersectionObserver mock ───────────────────────────────────────────────
//
// Tracks construction count so we can assert that the observer is built
// exactly once per sentinel element, regardless of how many times the hook's
// inputs (loading, hasNextPage, onLoadMore) change. The earlier implementation
// rebuilt the observer on every prop change, and a freshly-constructed
// observer attached to a target already inside the rootMargin re-fires
// `isIntersecting` on the next tick — producing an infinite load loop.

interface MockObserverState {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
}

let observerInstances: MockObserverState[] = [];

class MockIntersectionObserver {
  private state: MockObserverState;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.state = { callback, options, observed: [], disconnected: false };
    observerInstances.push(this.state);
  }

  observe(target: Element) {
    this.state.observed.push(target);
  }

  disconnect() {
    this.state.disconnected = true;
  }

  unobserve() {
    /* no-op for our tests */
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // Test helper: simulate an intersection event for this observer.
  trigger(isIntersecting: boolean) {
    const entry = {
      isIntersecting,
      target: this.state.observed[0],
      time: 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
    } satisfies Omit<IntersectionObserverEntry, never> as IntersectionObserverEntry;
    this.state.callback([entry], this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  observerInstances = [];
  // jsdom does not implement IntersectionObserver; install our mock.
  (
    globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }
  ).IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  observerInstances = [];
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useInfiniteScroll', () => {
  it('attaches a single IntersectionObserver when the sentinel mounts', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ onLoadMore, loading: false, hasNextPage: true }),
    );

    // Mounting the sentinel element should construct exactly one observer.
    const node = document.createElement('div');
    result.current(node);

    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].observed).toEqual([node]);
    expect(observerInstances[0].disconnected).toBe(false);
  });

  it('does not rebuild the observer when loading, hasNextPage, or onLoadMore change', () => {
    // This is the core regression guard. Earlier the observer was reconstructed
    // on every prop change, which re-fired isIntersecting on a sentinel that
    // was still within rootMargin → an infinite load loop.
    const onLoadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ loading, hasNextPage, cb }) => useInfiniteScroll({ onLoadMore: cb, loading, hasNextPage }),
      { initialProps: { loading: false, hasNextPage: true, cb: onLoadMore } },
    );

    const node = document.createElement('div');
    result.current(node);
    expect(observerInstances).toHaveLength(1);

    // Flip loading, hasNextPage, and swap onLoadMore identity. None of these
    // should cause the observer to be torn down and re-created.
    rerender({ loading: true, hasNextPage: true, cb: vi.fn() });
    rerender({ loading: false, hasNextPage: true, cb: vi.fn() });
    rerender({ loading: false, hasNextPage: false, cb: vi.fn() });

    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].disconnected).toBe(false);
  });

  it('fires onLoadMore when the sentinel intersects and conditions are met', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ onLoadMore, loading: false, hasNextPage: true }),
    );

    const node = document.createElement('div');
    result.current(node);
    (observerInstances[0] as unknown as { callback: IntersectionObserverCallback }).callback(
      [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('skips onLoadMore while a fetch is in flight', () => {
    // Even if the observer fires (e.g. because the sentinel is still in
    // viewport), we must not stack concurrent loads. The hook reads `loading`
    // from its latest-value ref at fire time.
    const onLoadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ loading }) => useInfiniteScroll({ onLoadMore, loading, hasNextPage: true }),
      { initialProps: { loading: false } },
    );

    const node = document.createElement('div');
    result.current(node);

    // Simulate first intersection — should fire.
    (observerInstances[0] as unknown as { callback: IntersectionObserverCallback }).callback(
      [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Now a fetch is in flight. Subsequent intersection events must be ignored.
    rerender({ loading: true });
    (observerInstances[0] as unknown as { callback: IntersectionObserverCallback }).callback(
      [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('skips onLoadMore once hasNextPage becomes false', () => {
    const onLoadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ hasNextPage }) => useInfiniteScroll({ onLoadMore, loading: false, hasNextPage }),
      { initialProps: { hasNextPage: true } },
    );

    const node = document.createElement('div');
    result.current(node);

    rerender({ hasNextPage: false });
    (observerInstances[0] as unknown as { callback: IntersectionObserverCallback }).callback(
      [{ isIntersecting: true, target: node } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('disconnects the previous observer when the sentinel is replaced', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ onLoadMore, loading: false, hasNextPage: true }),
    );

    const first = document.createElement('div');
    result.current(first);
    expect(observerInstances).toHaveLength(1);

    // Detach (e.g. the sentinel re-keys or unmounts).
    result.current(null);
    expect(observerInstances[0].disconnected).toBe(true);

    // Re-attach with a new node — exactly one new observer is constructed.
    const second = document.createElement('div');
    result.current(second);
    expect(observerInstances).toHaveLength(2);
    expect(observerInstances[1].observed).toEqual([second]);
  });
});
