'use client';

import { useEffect, type ReactNode } from 'react';

import { Portal } from './Portal';
import styles from './FilterDrawer.module.css';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Content rendered inside the scrollable body of the drawer. */
  children: ReactNode;
  /** Optional sticky footer — typically holds "Apply" / "Clear all" buttons. */
  footer?: ReactNode;
}

/**
 * A mobile-first drawer that portals to document.body.
 *
 * - Bottom-sheet on phones (<640px).
 * - Right-side drawer on tablets (640–1023px).
 * - Not intended for desktop; on desktop (>=1024px) the calling page should
 *   render its filters inline instead of using this component.
 *
 * Handles: Escape to close, backdrop click to close, and locks body scroll
 * while open. Rendered via Portal so it escapes any ancestor stacking context.
 */
export function FilterDrawer({
  isOpen,
  onClose,
  title = 'Filters',
  children,
  footer,
}: FilterDrawerProps) {
  // Lock body scroll + Escape-to-close while open
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className={styles.overlay}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className={styles.drawer} role="dialog" aria-modal="true" aria-label={title}>
          <div className={styles.header}>
            <span className={styles.title}>{title}</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close filters"
            >
              ✕
            </button>
          </div>

          <div className={styles.body}>{children}</div>

          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
