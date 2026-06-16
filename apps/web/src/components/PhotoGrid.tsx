'use client';

import Link from 'next/link';

import { PhotoCard, type PhotoData } from './PhotoCard';
export type { PhotoData };
import { AdBanner } from './AdBanner';
import { Pagination } from './Pagination';
import type { FollowReason } from '@/lib/followReasons';
import styles from './PhotoGrid.module.css';

interface PhotoGridProps {
  photos: PhotoData[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  viewMode?: 'grid' | 'list';
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Slot ID for in-feed AdSense ad. If omitted, no ads are injected. */
  adSlotId?: string;
  /** Insert an ad every N photos (default: 12). */
  adInterval?: number;
  /**
   * Optional per-photo "via X" reasons. When present, each PhotoCard in the
   * grid view shows a chip indicating which follow caused the photo to
   * appear. Omit on lists/grids where the reason is irrelevant (e.g. the
   * Recent feed). Only used in grid view — the list view renders each row
   * as a single Link and adding a chip inline would be more invasive.
   */
  reasonsByPhotoId?: Record<string, FollowReason[]>;
}

/**
 * Renders a responsive grid (or list) of PhotoCards with numbered pagination.
 */
export function PhotoGrid({
  photos,
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  emptyMessage = 'No photos yet',
  viewMode = 'grid',
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  adSlotId,
  adInterval = 12,
  reasonsByPhotoId,
}: PhotoGridProps) {
  if (!loading && photos.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📷</div>
        <p className={styles.emptyText}>{emptyMessage}</p>
        <p className={styles.emptySub}>Be the first to share an aviation photo!</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <>
        <div className={styles.list}>
          {photos.map((photo) => {
            const thumb =
              photo.variants?.find(
                (v: { variantType: string }) => v.variantType === 'thumbnail_16x9',
              ) ??
              photo.variants?.find((v: { variantType: string }) => v.variantType === 'thumbnail');
            const imgUrl = thumb?.url ?? photo.originalUrl;
            const isSelected = selectedIds.has(photo.id);

            const aircraftParts = [
              photo.aircraft?.manufacturer?.name,
              photo.aircraft?.family?.name,
              photo.aircraft?.variant?.name,
            ].filter(Boolean);
            const aircraftLabel = aircraftParts.join(' · ');

            const takenDate = photo.takenAt
              ? new Date(photo.takenAt).toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : null;

            const displayName = photo.user.profile?.displayName ?? photo.user.username;

            return (
              <Link
                key={photo.id}
                href={`/photos/${photo.id}`}
                className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                onClick={(e) => {
                  // Allow checkbox interaction without navigating
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                    e.preventDefault();
                  }
                }}
              >
                {selectable && (
                  <input
                    type="checkbox"
                    className={styles.listCheckbox}
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect?.(photo.id);
                    }}
                  />
                )}
                <div className={styles.listThumb}>
                  <img src={imgUrl} alt={photo.caption ?? ''} />
                </div>
                <div className={styles.listMeta}>
                  <div className={styles.listCaption}>{photo.caption ?? '—'}</div>

                  {/* Aircraft registration + type */}
                  {(photo.aircraft?.registration || aircraftLabel) && (
                    <div className={styles.listAircraftRow}>
                      {photo.aircraft?.registration && <span>{photo.aircraft.registration}</span>}
                      {photo.aircraft?.registration && aircraftLabel && (
                        <span className={styles.listDetailSep}>·</span>
                      )}
                      {aircraftLabel && <span>{aircraftLabel}</span>}
                    </div>
                  )}

                  <div className={styles.listDetails}>
                    {photo.airline && <span>✈️ {photo.airline}</span>}
                    {photo.airportCode && <span>📍 {photo.airportCode}</span>}
                    {takenDate && <span>📅 {takenDate}</span>}
                    {photo.gearBody && <span>📷 {photo.gearBody}</span>}
                    {photo.gearLens && <span>🔭 {photo.gearLens}</span>}
                  </div>

                  <div className={styles.listFooter}>
                    <span className={styles.listAuthor}>{displayName}</span>
                    <div className={styles.listStats}>
                      <span>❤️ {photo.likeCount ?? 0}</span>
                      <span>💬 {photo.commentCount ?? 0}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            loading={loading}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={styles.grid}>
        {photos
          .map((photo, index) => {
            const items = [
              <PhotoCard key={photo.id} photo={photo} reasons={reasonsByPhotoId?.[photo.id]} />,
            ];
            // Inject ad after every adInterval photos (not after the last batch)
            if (adSlotId && (index + 1) % adInterval === 0 && index < photos.length - 1) {
              items.push(
                <div key={`ad-${photo.id}`} className={styles.adSlot}>
                  <AdBanner slotId={adSlotId} />
                </div>,
              );
            }
            return items;
          })
          .flat()}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          loading={loading}
        />
      )}
    </>
  );
}
