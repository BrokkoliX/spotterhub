'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the index at which to split the home-page photo feed for the
 * in-feed community widget block. On a desktop three-column grid the
 * block is anchored after the second row (index 6); on mobile (single
 * column) it sits after the second card (index 2).
 *
 * The breakpoint matches PhotoGrid's CSS, which switches from three
 * columns to one at `--bp-md` (768px). The hook is SSR-safe: it returns
 * the desktop value on the server and during the first client render to
 * avoid hydration mismatches, then resyncs once `window.matchMedia` is
 * available. On mobile the visible slip from "after row two" (six
 * cards) to "after card two" happens in a single paint, which is
 * acceptable because the block is below the fold on mobile anyway.
 */
const DESKTOP_SPLIT_INDEX = 6;
const MOBILE_SPLIT_INDEX = 2;
const MOBILE_BREAKPOINT = '(max-width: 767px)';

export function useResponsiveSplitIndex(): number {
  const [splitIndex, setSplitIndex] = useState<number>(DESKTOP_SPLIT_INDEX);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const sync = () => setSplitIndex(mq.matches ? MOBILE_SPLIT_INDEX : DESKTOP_SPLIT_INDEX);
    sync();
    // Older Safari uses addListener / removeListener; modern browsers use
    // addEventListener('change'). Support both so the hook works on the
    // full target browser matrix.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return splitIndex;
}
