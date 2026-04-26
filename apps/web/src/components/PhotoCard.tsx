import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { FollowButton } from './FollowButton';
import { LikeButton } from './LikeButton';
import { TopicFollowButton } from './TopicFollowButton';
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
  operatorIcao?: string | null;
  operatorType?: string | null;
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
    registration?: string | null;
    isFollowedByMe?: boolean;
    manufacturer?: { id?: string; name: string; isFollowedByMe?: boolean } | null;
    family?: { id?: string; name: string; isFollowedByMe?: boolean } | null;
    variant?: { id?: string; name: string; iataCode?: string | null; icaoCode?: string | null; isFollowedByMe?: boolean } | null;
    operatorType?: string | null;
  } | null;
  listing?: {
    id: string;
    priceUsd: string;
    active: boolean;
  } | null;
  hasActiveListing?: boolean;
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

  return (
    <article className={styles.card}>
      <Link href={`/photos/${photo.id}`} className={styles.imageWrapper}>
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
        {photo.listing?.active && photo.listing?.priceUsd && (
          <span className={styles.priceBadge}>${photo.listing.priceUsd}</span>
        )}
      </Link>

      <div className={styles.body}>
        {photo.caption && <p className={styles.caption}>{photo.caption}</p>}

        <div className={styles.meta}>
          {photo.aircraft?.registration && (
            <span className={styles.metaItem}>
              📋 {photo.aircraft.registration}
              {user && (
                <TopicFollowButton
                  targetType="registration"
                  value={photo.aircraft.registration}
                  initialIsFollowing={photo.aircraft.isFollowedByMe ?? false}
                />
              )}
            </span>
          )}
          {photo.aircraft?.manufacturer?.name && (
            <span className={styles.metaItem}>
              {photo.aircraft.manufacturer.name}
              {user && (
                <TopicFollowButton
                  targetType="manufacturer"
                  value={photo.aircraft.manufacturer.name}
                  initialIsFollowing={photo.aircraft.manufacturer.isFollowedByMe ?? false}
                />
              )}
            </span>
          )}
          {photo.aircraft?.family?.name && (
            <span className={styles.metaItem}>
              {photo.aircraft.family.name}
              {user && (
                <TopicFollowButton
                  targetType="family"
                  value={photo.aircraft.family.name}
                  initialIsFollowing={photo.aircraft.family.isFollowedByMe ?? false}
                />
              )}
            </span>
          )}
          {photo.aircraft?.variant?.name && (
            <span className={styles.metaItem}>
              {photo.aircraft.variant.name}
              {user && (
                <TopicFollowButton
                  targetType="variant"
                  value={photo.aircraft.variant.name}
                  initialIsFollowing={photo.aircraft.variant.isFollowedByMe ?? false}
                />
              )}
            </span>
          )}
          {photo.airline && (
            <span className={styles.metaItem}>
              {photo.airline}
              {user && (
                <TopicFollowButton
                  targetType="airline"
                  value={photo.airline}
                  initialIsFollowing={false}
                />
              )}
            </span>
          )}
          {photo.operatorIcao && (
            <span className={styles.metaItem}>
              ✈ {photo.operatorIcao}
              {user && (
                <TopicFollowButton
                  targetType="airline"
                  value={photo.operatorIcao}
                  initialIsFollowing={false}
                />
              )}
            </span>
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
    </article>
  );
}