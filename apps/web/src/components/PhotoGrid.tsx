'use client';

import { PhotoCard, type PhotoData } from './PhotoCard';
export type { PhotoData };
import styles from './PhotoGrid.module.css';

interface PhotoGridProps {
  photos: PhotoData[];
  hasNextPage: boolean;
  loading: boolean;
  onLoadMore: () => void;
  emptyMessage?: string;
  viewMode?: 'grid' | 'list';
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * Renders a responsive grid (or list) of PhotoCards with a "Load more" button.
 */
export function PhotoGrid({
  photos,
  hasNextPage,
  loading,
  onLoadMore,
  emptyMessage = 'No photos yet',
  viewMode = 'grid',
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
}: PhotoGridProps) {
  if (!loading && photos.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📷</div>
        <p className={styles.emptyText}>{emptyMessage}</p>
        <p className={styles.emptySub}>
          Be the first to share an aviation photo!
        </p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <>
        <div className={styles.list}>
          {photos.map((photo) => {
            const thumb = photo.variants?.find(
              (v: { variantType: string }) => v.variantType === 'thumbnail',
            );
            const imgUrl = thumb?.url ?? photo.originalUrl;
            const isSelected = selectedIds.has(photo.id);
            return (
              <div
                key={photo.id}
                className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
              >
                {selectable && (
                  <input
                    type="checkbox"
                    className={styles.listCheckbox}
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(photo.id)}
                  />
                )}
                <div className={styles.listThumb}>
                  <img src={imgUrl} alt={photo.caption ?? ''} />
                </div>
                <div className={styles.listMeta}>
                  <div className={styles.listCaption}>{photo.caption ?? '—'}</div>
                  <div className={styles.listDetails}>
                    {photo.aircraft?.registration && (
                      <span>{photo.aircraft.registration}</span>
                    )}
                    {photo.aircraft?.manufacturer?.name && (
                      <span>{photo.aircraft.manufacturer.name}</span>
                    )}
                    {photo.airline && <span>{photo.airline}</span>}
                    {photo.airportCode && <span>{photo.airportCode}</span>}
                    <span>{photo.likeCount ?? 0} ❤️</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasNextPage && (
          <div className={styles.loadMore}>
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="btn btn-secondary btn-lg"
              type="button"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={styles.grid}>
        {photos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>

      {hasNextPage && (
        <div className={styles.loadMore}>
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="btn btn-secondary btn-lg"
            type="button"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
