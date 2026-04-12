'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADD_PHOTOS_TO_ALBUM, ADD_PHOTOS_TO_COMMUNITY_ALBUM, GET_PHOTOS } from '@/lib/queries';
import type { PhotoData } from './PhotoCard';

import styles from './AddPhotosModal.module.css';

const PICKER_PAGE_SIZE = 30;

interface AddPhotosModalProps {
  albumId: string;
  /** IDs of photos already in the album, to exclude from the picker. */
  existingPhotoIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
  /** If true, uses addPhotosToCommunityAlbum mutation and adjusts UI text. */
  isCommunityAlbum?: boolean;
}

/**
 * Modal that lets the album owner pick from their own photos (not already in the
 * album) and add them via the addPhotosToAlbum mutation.
 */
export function AddPhotosModal({
  albumId,
  existingPhotoIds,
  onClose,
  onAdded,
  isCommunityAlbum = false,
}: AddPhotosModalProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);

  // Fetch the current user's photos (no albumId filter — we'll exclude client-side)
  const [photosResult] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PICKER_PAGE_SIZE, after: cursor, userId: user?.id },
    pause: !user,
  });

  const [addResult, addPhotos] = useMutation(
    isCommunityAlbum ? ADD_PHOTOS_TO_COMMUNITY_ALBUM : ADD_PHOTOS_TO_ALBUM,
  );

  const connection = photosResult.data?.photos;
  const fetchedPhotos: PhotoData[] = photosResult.data?.photos?.edges?.map(
    (e: { node: PhotoData }) => e.node,
  ) ?? [];

  // Merge paginated results and exclude photos already in the album
  const photos =
    allPhotos.length > 0
      ? allPhotos.filter((p) => !existingPhotoIds.has(p.id))
      : fetchedPhotos.filter((p) => !existingPhotoIds.has(p.id));

  const togglePhoto = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLoadMore = useCallback(() => {
    if (connection?.pageInfo?.endCursor) {
      setAllPhotos((prev) => {
        const existing = prev.length > 0 ? prev : fetchedPhotos;
        const newPhotos = fetchedPhotos.filter(
          (p: PhotoData) => !existing.some((ep: PhotoData) => ep.id === p.id),
        );
        return [...existing, ...newPhotos];
      });
      setCursor(connection.pageInfo.endCursor);
    }
  }, [connection, fetchedPhotos]);

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    const res = await addPhotos({
      albumId,
      photoIds: Array.from(selected),
    });
    if (!res.error) {
      onAdded();
      onClose();
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getThumbUrl = (photo: PhotoData) => {
    const thumb = photo.variants.find((v) => v.variantType === 'thumbnail');
    const display = photo.variants.find((v) => v.variantType === 'display');
    return thumb?.url ?? display?.url ?? photo.originalUrl;
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <h2 className={styles.title}>
          {isCommunityAlbum ? 'Add your photos to this album' : 'Add Photos to Album'}
        </h2>

        {/* Loading */}
        {photosResult.fetching && allPhotos.length === 0 && (
          <p className={styles.loading}>Loading your photos…</p>
        )}

        {/* Empty */}
        {!photosResult.fetching && photos.length === 0 && (
          <p className={styles.empty}>
            No available photos to add.{' '}
            <Link href="/upload" style={{ color: 'var(--color-accent)' }}>
              Upload some photos
            </Link>{' '}
            to your collection first!
          </p>
        )}

        {/* Photo picker grid */}
        {photos.length > 0 && (
          <div className={styles.pickerGrid}>
            {photos.map((photo) => {
              const isSelected = selected.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`${styles.pickerItem} ${isSelected ? styles.pickerItemSelected : ''}`}
                  onClick={() => togglePhoto(photo.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePhoto(photo.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={photo.caption ?? `Photo ${photo.id}`}
                >
                  {getThumbUrl(photo) ? (
                    <img
                      src={getThumbUrl(photo)}
                      alt={photo.caption ?? ''}
                      className={styles.pickerImage}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.pickerPlaceholder}>📷</div>
                  )}
                  {isSelected && <div className={styles.checkMark}>✓</div>}
                  {photo.caption && (
                    <div className={styles.pickerCaption}>{photo.caption}</div>
                  )}
                </div>
              );
            })}

            {/* Load more button inside grid */}
            {connection?.pageInfo?.hasNextPage && (
              <div className={styles.loadMoreRow}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleLoadMore}
                  disabled={photosResult.fetching}
                >
                  {photosResult.fetching ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {addResult.error && (
          <p className={styles.error}>{addResult.error.message}</p>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.selectedCount}>
            {selected.size > 0
              ? `${selected.size} photo${selected.size === 1 ? '' : 's'} selected`
              : 'Select photos to add'}
          </span>
          <div className={styles.footerActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={selected.size === 0 || addResult.fetching}
            >
              {addResult.fetching
                ? 'Adding…'
                : `Add ${selected.size || ''} Photo${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
