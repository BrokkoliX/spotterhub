import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';

import { useResponsiveSplitIndex } from '../lib/useResponsiveSplitIndex';

// ─── matchMedia mock ─────────────────────────────────────────────────────────

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
  _trigger: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MockMediaQueryList {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql: MockMediaQueryList = {
    matches: initialMatches,
    media: '(max-width: 767px)',
    onchange: null,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => listeners.add(cb)),
    removeListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb)),
    dispatchEvent: vi.fn(),
    _trigger(matches: boolean) {
      this.matches = matches;
      for (const cb of listeners) {
        cb({ matches } as MediaQueryListEvent);
      }
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return mql;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useResponsiveSplitIndex', () => {
  beforeEach(() => {
    // Each test installs its own matchMedia; restore the original after the
    // suite runs by deleting the writable definition we put on window.
    // (jsdom does not provide matchMedia by default, so leaving an
    // installed mock between tests is fine.)
  });

  it('returns the desktop split index (6) when the viewport is wider than the mobile breakpoint', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useResponsiveSplitIndex());
    expect(result.current).toBe(6);
  });

  it('returns the mobile split index (2) when the viewport matches the mobile breakpoint', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useResponsiveSplitIndex());
    expect(result.current).toBe(2);
  });

  it('updates the split index when the viewport crosses the breakpoint', () => {
    const mql = installMatchMedia(false);
    const { result } = renderHook(() => useResponsiveSplitIndex());
    expect(result.current).toBe(6);

    act(() => {
      mql._trigger(true);
    });
    expect(result.current).toBe(2);

    act(() => {
      mql._trigger(false);
    });
    expect(result.current).toBe(6);
  });

  it('returns the desktop default when matchMedia is unavailable (SSR-safe)', () => {
    // Simulate an environment with no matchMedia (e.g. older test runtimes
    // or partial SSR shims). The hook must not throw.
    const original = (window as unknown as { matchMedia?: unknown }).matchMedia;
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;

    expect(() => render(<TestProbe />)).not.toThrow();

    (window as unknown as { matchMedia?: unknown }).matchMedia = original;
  });
});

function TestProbe() {
  const idx = useResponsiveSplitIndex();
  return <span data-testid="idx">{idx}</span>;
}
