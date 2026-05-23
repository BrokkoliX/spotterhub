import Link from 'next/link';
import { useState } from 'react';

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
  operatorIcao?: string | null;
  operatorType?: string | null;
  originalUrl: string;
  originalWidth?: number | null;
  originalHeight?: number | null;
  tags: string[];
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  takenAt?: string | null;
  gearBody?: string | null;
  gearLens?: string | null;
  kind?: 'AIRCRAFT' | 'COMMUNITY' | null;
  communityCategory?: 'SCENERY' | 'EVENT' | 'HANGAR' | 'AIRPORT' | 'PEOPLE' | 'OTHER' | null;
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
    variant?: {
      id?: string;
      name: string;
      iataCode?: string | null;
      icaoCode?: string | null;
      isFollowedByMe?: boolean;
    } | null;
    operatorType?: string | null;
  } | null;
  watermarkEnabled?: boolean | null;
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
  const [imgError, setImgError] = useState(false);

  const thumbnail16x9Variant = photo.variants.find((v) => v.variantType === 'thumbnail_16x9');
  const displayVariant = photo.variants.find((v) => v.variantType === 'display');
  const thumbnailVariant = photo.variants.find((v) => v.variantType === 'thumbnail');
  // Always prefer the 16:9 cropped thumbnail for feed cards so every card
  // renders at a uniform landscape aspect ratio regardless of orientation.
  const imageUrl =
    thumbnail16x9Variant?.url ?? displayVariant?.url ?? thumbnailVariant?.url ?? photo.originalUrl;
  const displayName = photo.user.profile?.displayName ?? photo.user.username;

  // JetPhotos-style info
  const isCommunity = photo.kind === 'COMMUNITY';
  const communityCategoryLabel = photo.communityCategory
    ? photo.communityCategory.charAt(0) + photo.communityCategory.slice(1).toLowerCase()
    : null;
  const infoRegistration = isCommunity ? null : photo.aircraft?.registration;
  const infoAirline = isCommunity ? null : photo.airline || photo.operatorIcao;
  const infoAirport = photo.airportCode;
  const infoDate = photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const infoCamera = photo.gearBody;
  const infoLens = photo.gearLens;

  // Build a human-readable aircraft type string, e.g. "Boeing 737 800"
  const infoAircraftType = isCommunity
    ? null
    : [
        photo.aircraft?.manufacturer?.name,
        photo.aircraft?.family?.name,
        photo.aircraft?.variant?.name,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' ') || null;

  const hasInfo =
    infoRegistration ||
    infoAirline ||
    infoAirport ||
    infoDate ||
    infoCamera ||
    infoLens ||
    infoAircraftType ||
    isCommunity;

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

      {hasInfo && (
        <div className={styles.photoInfo}>
          <div className={styles.photoInfoRow}>
            {isCommunity ? (
              <>
                <span className={styles.photoInfoReg}>Community</span>
                {communityCategoryLabel && (
                  <span className={styles.photoInfoOp}>{communityCategoryLabel}</span>
                )}
              </>
            ) : (
              <>
                {infoRegistration && (
                  <span className={styles.photoInfoReg}>{infoRegistration}</span>
                )}
                {infoAirline && <span className={styles.photoInfoOp}>{infoAirline}</span>}
              </>
            )}
            {infoAirport && <span className={styles.photoInfoAirport}>📍 {infoAirport}</span>}
            {infoDate && <span className={styles.photoInfoDate}>{infoDate}</span>}
          </div>
          {infoAircraftType && (
            <div className={styles.photoInfoRow}>
              <span className={styles.photoInfoOp}>{infoAircraftType}</span>
            </div>
          )}
          {(infoCamera || infoLens) && (
            <div className={styles.photoInfoRow}>
              {infoCamera && <span className={styles.photoInfoGear}>{infoCamera}</span>}
              {infoLens && <span className={styles.photoInfoGear}>{infoLens}</span>}
            </div>
          )}
        </div>
      )}

      <div className={styles.body}>
        {photo.caption && <p className={styles.caption}>{photo.caption}</p>}

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
          <Link href={`/u/${photo.user.username}/photos`} className={styles.user}>
            {displayName}
          </Link>
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
