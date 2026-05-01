'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

/**
 * Renders children into `document.body` via a React portal.
 *
 * Use this for overlays (modals, drawers, menus) that must escape any
 * ancestor stacking context — e.g. a sticky header with `backdrop-filter`
 * which would otherwise clip/hide them regardless of z-index.
 *
 * SSR-safe: renders nothing on the server and on the first client render,
 * then portals on the second render once `document` is available.
 */
export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Intentional: flip to `true` after hydration so `createPortal` runs only
    // on the client. This is the canonical SSR-safe portal pattern and is
    // the specific case the rule does not account for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}
