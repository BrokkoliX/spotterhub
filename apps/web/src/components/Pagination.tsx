'use client';

import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/**
 * Numbered pagination control with Previous/Next and jump-to-page.
 * Shows ellipsis for large page counts.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build the list of page buttons to show
  function getPageNumbers(): (number | '...')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [];

    if (currentPage <= 4) {
      // Near the start: 1 2 3 4 5 ... N
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      // Near the end: 1 ... N-4 N-3 N-2 N-1 N
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      // Middle: 1 ... cur-1 cur cur+1 ... N
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  }

  const pageNumbers = getPageNumbers();

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <div className={styles.pageInfo}>
        Page {currentPage} of {totalPages}
      </div>

      <div className={styles.controls}>
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          aria-label="Previous page"
        >
          ← Prev
        </button>

        {pageNumbers.map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === currentPage ? styles.active : ''}`}
              onClick={() => onPageChange(p as number)}
              disabled={loading}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>

      <div className={styles.jumpTo}>
        <label className={styles.jumpLabel}>
          Jump to:
          <input
            type="number"
            min={1}
            max={totalPages}
            className={styles.jumpInput}
            defaultValue={currentPage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                const val = parseInt(input.value, 10);
                if (val >= 1 && val <= totalPages) {
                  onPageChange(val);
                  input.blur();
                }
              }
            }}
          />
        </label>
      </div>
    </nav>
  );
}
