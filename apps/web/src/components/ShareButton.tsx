'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './ShareButton.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShareButtonProps {
  /** Photo ID; combined with the public origin to build the canonical URL. */
  photoId: string;
  /** Optional caption used as the share text on platforms that accept it. */
  photoCaption?: string | null;
  /** Photographer's display name for share text attribution. */
  photographerName?: string | null;
  /** Optional aircraft label (e.g. registration) used as a fallback title. */
  aircraftLabel?: string | null;
}

/**
 * Status of the per-click "Copied!" feedback. Lives in component state so
 * the message clears automatically after a short timeout.
 */
type CopyStatus = 'idle' | 'copied' | 'failed';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical public origin used to build shareable URLs.
 * Prefers the build-time `NEXT_PUBLIC_WEB_URL` so links generated on
 * mobile share to the production host even when the user is on staging,
 * and falls back to `window.location.origin` so dev still Just Works.
 *
 * Returns null only on the server during render — every consumer in this
 * component is inside a click handler, so the fallback is always available
 * by the time the value is used.
 */
function resolvePublicOrigin(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_WEB_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return null;
}

/** Build the human-readable share text shown in tweets / share sheets. */
function buildShareText(props: ShareButtonProps): string {
  const subject = props.photoCaption?.trim() || props.aircraftLabel || 'Aviation photo';
  const author = props.photographerName ?? null;
  return author ? `${subject} — by ${author} on SpotterSpace` : `${subject} on SpotterSpace`;
}

/**
 * Open a small popup window for a third-party share intent. We use
 * `noopener,noreferrer` because the destination is an arbitrary origin
 * and we never need a handle back to the popup.
 */
function openSharePopup(url: string): void {
  window.open(
    url,
    '_blank',
    'noopener,noreferrer,width=600,height=520,menubar=no,toolbar=no,resizable=yes,scrollbars=yes',
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Progressive-enhancement share button.
 *
 * On platforms that implement the Web Share API (most mobile browsers,
 * Safari on macOS) a single click opens the native OS share sheet, which
 * surfaces every installed app — including Instagram on iOS/Android.
 *
 * Everywhere else (most desktop browsers) the button toggles a small
 * popover with explicit Facebook, X, and "Copy link" actions. We do not
 * render a dedicated Instagram button on the desktop fallback because
 * Instagram exposes no public web share intent URL; "Copy link" is the
 * standard workaround there.
 */
export function ShareButton(props: ShareButtonProps) {
  const { photoId } = props;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close the popover on outside click / Escape so it behaves like a menu.
  useEffect(() => {
    if (!popoverOpen) return;

    const handlePointer = (e: PointerEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [popoverOpen]);

  // Clear any pending "Copied!" reset on unmount so we don't setState
  // after the component is gone.
  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  const buildUrl = useCallback((): string | null => {
    const origin = resolvePublicOrigin();
    if (!origin) return null;
    return `${origin}/photos/${encodeURIComponent(photoId)}`;
  }, [photoId]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const url = buildUrl();
      if (!url) return;

      const text = buildShareText(props);
      const title = props.photoCaption?.trim() || props.aircraftLabel || 'SpotterSpace photo';

      // Prefer the native share sheet when available — it's the path that
      // gives users access to Instagram, Messages, AirDrop, etc.
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (err) {
          // AbortError = user dismissed; treat as a no-op rather than
          // surfacing the desktop popover.
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // For any other failure, fall through to the popover so the user
          // still has a way to share.
        }
      }

      setPopoverOpen((prev) => !prev);
    },
    [buildUrl, props],
  );

  const handleFacebook = useCallback(() => {
    const url = buildUrl();
    if (!url) return;
    openSharePopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    setPopoverOpen(false);
  }, [buildUrl]);

  const handleX = useCallback(() => {
    const url = buildUrl();
    if (!url) return;
    const text = buildShareText(props);
    // twitter.com/intent/tweet still works and auto-redirects to x.com,
    // and is more widely embedded by browser extensions and link tools.
    openSharePopup(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    );
    setPopoverOpen(false);
  }, [buildUrl, props]);

  const handleCopy = useCallback(async () => {
    const url = buildUrl();
    if (!url) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopyStatus('copied');
      } else {
        setCopyStatus('failed');
      }
    } catch {
      setCopyStatus('failed');
    }

    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
  }, [buildUrl]);

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.button}
        onClick={handleClick}
        aria-label="Share photo"
        aria-haspopup="menu"
        aria-expanded={popoverOpen}
      >
        <span className={styles.icon} aria-hidden="true">
          ↗
        </span>
        <span>Share</span>
      </button>

      {popoverOpen && (
        <div className={styles.popover} role="menu" aria-label="Share options">
          <button
            type="button"
            role="menuitem"
            className={styles.popoverItem}
            onClick={handleFacebook}
          >
            <FacebookIcon />
            <span>Facebook</span>
          </button>
          <button type="button" role="menuitem" className={styles.popoverItem} onClick={handleX}>
            <XIcon />
            <span>X (Twitter)</span>
          </button>
          <button type="button" role="menuitem" className={styles.popoverItem} onClick={handleCopy}>
            <LinkIcon />
            <span>
              {copyStatus === 'copied'
                ? 'Copied!'
                : copyStatus === 'failed'
                  ? 'Copy failed'
                  : 'Copy link'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────
//
// Inline SVGs inherit `currentColor` so they restyle automatically with the
// surrounding menu-item text and avoid pulling in an icon library.

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.49-1.46H17V4.45A21 21 0 0 0 14.86 4.3c-2.13 0-3.6 1.3-3.6 3.69V10.5H8.6v3h2.66V21h2.24Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.53 3H20.5l-6.55 7.49L21.75 21h-6.03l-4.72-6.18L5.6 21H2.62l7.01-8.02L2.25 3h6.18l4.27 5.65L17.53 3Zm-1.06 16.2h1.66L7.6 4.7H5.84l10.63 14.5Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 13.5a3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1 1M14.5 10.5a3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
