'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './SocialShareIcons.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SocialShareIconsProps {
  /** Photo ID; combined with the public origin to build the canonical URL. */
  photoId: string;
  /** Optional caption used as the share text on platforms that accept it. */
  photoCaption?: string | null;
  /** Photographer's display name for share text attribution. */
  photographerName?: string | null;
  /** Optional aircraft label (e.g. registration) used as a fallback subject. */
  aircraftLabel?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical public origin used to build shareable URLs.
 *
 * Prefers `NEXT_PUBLIC_WEB_URL` so links generated on a non-prod origin
 * (preview deploy, mobile tunnel) still point at production. Falls back
 * to `window.location.origin` so dev Just Works.
 */
function resolvePublicOrigin(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_WEB_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return null;
}

/** Build the human-readable share text shown in tweets. */
function buildShareText(props: SocialShareIconsProps): string {
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
 * Inline row of social-network share icons (Facebook, X, Instagram) shown
 * directly under the photo. Always visible, one click per network.
 *
 * Why these three behaviors:
 *
 * - **Facebook** opens `facebook.com/sharer.php` in a popup. The user
 *   confirms the post; FB renders our OpenGraph tags as the preview.
 * - **X (Twitter)** opens `twitter.com/intent/tweet` in a popup with a
 *   pre-filled link and caption.
 * - **Instagram** has no public web share API — there is no URL we can
 *   open that posts a photo to a user's IG feed. Linking to our own IG
 *   profile would mislead users in share intent and lose the photo
 *   context. So we copy the photo URL to the clipboard and show a brief
 *   toast nudging the user to paste it into a story or post. This is the
 *   pattern Pinterest, ArtStation, and 500px use, and it preserves
 *   "SpotterSpace" attribution in the user's content.
 */
export function SocialShareIcons(props: SocialShareIconsProps) {
  const { photoId } = props;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending toast-reset on unmount so we don't setState after
  // the component is gone.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const buildUrl = useCallback((): string | null => {
    const origin = resolvePublicOrigin();
    if (!origin) return null;
    return `${origin}/photos/${encodeURIComponent(photoId)}`;
  }, [photoId]);

  const handleFacebook = useCallback(() => {
    const url = buildUrl();
    if (!url) return;
    openSharePopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
  }, [buildUrl]);

  const handleX = useCallback(() => {
    const url = buildUrl();
    if (!url) return;
    const text = buildShareText(props);
    openSharePopup(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    );
  }, [buildUrl, props]);

  const handleInstagram = useCallback(async () => {
    const url = buildUrl();
    if (!url) return;

    // IG can't accept an inbound share intent, so we copy the link and
    // tell the user how to use it. Falling back to a plain message if the
    // clipboard API is unavailable still gives them something to act on.
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('Link copied — paste it in your Instagram story or post');
        return;
      }
    } catch {
      // fall through to the manual instruction below
    }
    showToast('Copy this link and paste it in Instagram: ' + url);
  }, [buildUrl, showToast]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.row} role="group" aria-label="Share to social networks">
        <button
          type="button"
          className={`${styles.icon} ${styles.facebook}`}
          onClick={handleFacebook}
          aria-label="Share on Facebook"
          title="Share on Facebook"
        >
          <FacebookIcon />
        </button>
        <button
          type="button"
          className={`${styles.icon} ${styles.x}`}
          onClick={handleX}
          aria-label="Share on X (Twitter)"
          title="Share on X (Twitter)"
        >
          <XIcon />
        </button>
        <button
          type="button"
          className={`${styles.icon} ${styles.instagram}`}
          onClick={handleInstagram}
          aria-label="Share on Instagram (copies link to clipboard)"
          title="Share on Instagram"
        >
          <InstagramIcon />
        </button>
      </div>
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────
//
// Inline SVGs at the social networks' canonical glyph paths so we don't
// pull in an icon library. `currentColor` lets each button drive its own
// brand color via CSS.

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.49-1.46H17V4.45A21 21 0 0 0 14.86 4.3c-2.13 0-3.6 1.3-3.6 3.69V10.5H8.6v3h2.66V21h2.24Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.53 3H20.5l-6.55 7.49L21.75 21h-6.03l-4.72-6.18L5.6 21H2.62l7.01-8.02L2.25 3h6.18l4.27 5.65L17.53 3Zm-1.06 16.2h1.66L7.6 4.7H5.84l10.63 14.5Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}
