'use client';

import { PhotoCard, type PhotoData } from './PhotoCard';
import styles from './PhotoGrid.module.css';

interface PhotoGridProps {
  photos: PhotoData[];
  hasNextPage: boolean;
  loading: boolean;
  onLoadMore: () => void;
  emptyMessage?: string;
}

/**
 * Renders a responsive grid of PhotoCards with a "Load more" button.
 */
export function PhotoGrid({
  photos,
  hasNextPage,
  loading,
  onLoadMore,
  emptyMessage = 'No photos yet',
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
