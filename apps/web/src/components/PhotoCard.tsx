import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { FollowButton } from './FollowButton';
import { LikeButton } from './LikeButton';
import styles from './PhotoCard.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PhotoVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

export interface PhotoData {
  id: string;
  caption?: string | null;
  airline?: string | null;
  airportCode?: string | null;
  originalUrl: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
    isFollowedByMe?: boolean;
    profile?: {
      displayName?: string | null;
      avatarUrl?: string | null;
    } | null;
  };
  variants: PhotoVariant[];
  aircraft?: {
    manufacturer?: { name: string } | null;
    family?: { name: string } | null;
    variant?: { name: string; iataCode?: string | null; icaoCode?: string | null } | null;
    operatorType?: string | null;
  } | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Displays a photo in a card format for use in grids and feeds.
 * Shows thumbnail variant if available, falls back to original URL.
 */
export function PhotoCard({ photo }: { photo: PhotoData }) {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);

  const displayVariant = photo.variants.find(
    (v) => v.variantType === 'display',
  );
  const thumbnailVariant = photo.variants.find(
    (v) => v.variantType === 'thumbnail',
  );
  const imageUrl =
    displayVariant?.url ?? thumbnailVariant?.url ?? photo.originalUrl;
  const displayName =
    photo.user.profile?.displayName ?? photo.user.username;
  const formattedDate = new Date(photo.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <article className={styles.card}>
      <div className={styles.cardInner}>
        {/* Front face */}
        <div className={`${styles.cardFace} ${styles.cardFront}`}>
          <Link href={`/photos/${photo.id}`}>
            <div className={styles.imageWrapper}>
              {imageUrl && !imgError ? (
                <img
                  src={imageUrl}
                  alt={photo.caption ?? `Photo by ${displayName}`}
                  className={styles.image}
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.placeholder}>📷</div>
              )}
            </div>
          </Link>

          <div className={styles.body}>
            {photo.caption && <p className={styles.caption}>{photo.caption}</p>}

            <div className={styles.meta}>
              {(photo.aircraft?.manufacturer?.name || photo.aircraft?.family?.name || photo.aircraft?.variant?.name) && (
                <span className={styles.metaItem}>✈ {[
                  photo.aircraft?.manufacturer?.name,
                  photo.aircraft?.family?.name,
                  photo.aircraft?.variant?.name,
                ].filter(Boolean).join(' ')}</span>
              )}
              {photo.airline && (
                <span className={styles.metaItem}>{photo.airline}</span>
              )}
              {photo.airportCode && (
                <span className={styles.metaItem}>📍 {photo.airportCode}</span>
              )}
            </div>

            {photo.tags.length > 0 && (
              <div className={styles.tags}>
                {photo.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <div className={styles.userArea}>
              <Link
                href={`/u/${photo.user.username}/photos`}
                className={styles.user}
              >
                {displayName}
              </Link>
              {user?.id !== photo.user.id && (
                <FollowButton
                  userId={photo.user.id}
                  initialIsFollowing={photo.user.isFollowedByMe ?? false}
                />
              )}
            </div>
            <div className={styles.stats}>
              <LikeButton
                photoId={photo.id}
                initialLikeCount={photo.likeCount}
                initialIsLiked={photo.isLikedByMe}
              />
              <Link href={`/photos/${photo.id}#comments`} className={styles.commentBtn}>
                💬 {photo.commentCount}
              </Link>
            </div>
          </div>
        </div>

        {/* Back face */}
        <div className={`${styles.cardFace} ${styles.cardBack}`}>
          {photo.caption && (
            <p className={styles.backCaption}>{photo.caption}</p>
          )}
          <div className={styles.backMeta}>
            {(photo.aircraft?.manufacturer?.name || photo.aircraft?.family?.name || photo.aircraft?.variant?.name) && (
              <span className={styles.backMetaItem}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                {[photo.aircraft?.manufacturer?.name, photo.aircraft?.family?.name, photo.aircraft?.variant?.name].filter(Boolean).join(' ')}
              </span>
            )}
            {photo.airline && (
              <span className={styles.backMetaItem}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9 5.8 5.2c-.5-.4-1-.8-1.5-1.3-.5.5-1 1-1.5 1.3L5 8 2.2 4.8C1.5 5.6 1 6.6 1 8v10c0 1 .5 2 1.2 2.8l3.3 4.4c.5.4 1 .8 1.5 1.3.5-.5 1-.9 1.5-1.3l2.8-3.3 2.8 3.3c.5.4 1 .8 1.5 1.3s1 1 1.5 1.3l3.3-4.4c.7-.8 1.2-1.8 1.2-2.8V9c0-.6-.2-1.2-.5-1.8z"/></svg>
                {photo.airline}
              </span>
            )}
            {photo.airportCode && (
              <span className={styles.backMetaItem}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {photo.airportCode}
              </span>
            )}
            <span className={styles.backMetaItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {formattedDate}
            </span>
          </div>
          <p className={styles.backDate}>Tap to see full details</p>
        </div>
      </div>
    </article>
  );
}
